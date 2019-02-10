"use strict";
var globalVar = require("global");
var util = require('./util/util');
var gunGet = util.gunGet
var gunGetGet = util.gunGetGet
var gunGetList = util.gunGetList
var gunGetListNodes = util.gunGetListNodes
var gunGetListProp = util.gunGetListProp
var getKeyByValue = util.getKeyByValue
var gunFilteredNodes = util.gunFilteredNodes
var nextIndex = util.nextIndex


if(typeof window !== "undefined"){
    var Gun = globalVar.Gun;
}else{
    var Gun = global.Gun;
}
let gun
let gbase = {}
let GB = {byAlias: {}, byGB: {}}
let gb = {}
let cache = {}
let gsubs = {}
let gunSubs = {}
let subBuffer = {}
let bufferState = false
let vTable = {}
let reactConfigCB
if (!Gun)
throw new Error("gundb-gbase: Gun was not found globally!");


gunchain(Gun.chain);


baseChain(gbase)

startGunConfigSubs()

function baseChain(gchain) {
    gchain.newBase = newBase
}
function gunchain(Gunchain) {
    Gunchain.gbase = gunToGbase
}
function gunToGbase(gunInstance){
    gun = gunInstance
}
function showgb(){
    console.log(gb)
}
function showcache(){
    console.log(cache)
}
function showgsub(){
    return gsubs
}
function showgunsub(){
    return gunSubs
}

//GBASE INITIALIZATION
function startGunConfigSubs(){
    if(typeof gun !== "undefined"){
        gun.get('GBase').on(function(gundata, id){
            let data = Gun.obj.copy(gundata)
            delete data['_']
            for (const key in data) {
                const value = data[key];
                if (value) {
                    let baseconfig = key + '/config'
                    gun.get(baseconfig).on(function(gundata, id){
                        gunSubs[baseconfig] = true
                        let data = Gun.obj.copy(gundata)
                        delete data['_']
                        mergeConfigState(data,id)
                        setupPropSubs(key)
                        rebuildGBchain(id)
                    })
                    let basestate = key + '/state'
                    gun.get(basestate).on(function(gundata, id){
                        gunSubs[basestate] = true
                        let data = Gun.obj.copy(gundata)
                        delete data['_']
                        let histpath = [key,'history']
                        let hist = (data.history) ? data.history : "{}"
                        setMergeValue(histpath,JSON.parse(hist),gb)
                    })
                }
            }
        })    }
    else{
        setTimeout(startGunConfigSubs, 50);
    }
}
function setupPropSubs(frompath){
    let pathArgs = frompath.split('/')
    if(pathArgs[pathArgs.length -1] === 'config'){
        pathArgs.pop()
    }
    if(pathArgs.length === 1){//find all tables
        let tpath = pathArgs.slice()
        tpath.push('t')
        tpath = tpath.join('/')
        gun.get(tpath).on(function(gundata, id){
            let data = Gun.obj.copy(gundata)
            delete data['_']
            for (const tval in data) {
                const value = data[tval];
                if (value) {
                    let tsoul = pathArgs.slice()
                    tsoul.push(tval)
                    tsoul.push('config')
                    tsoul = tsoul.join('/')
                    handleGunSubConfig(tsoul)//will sub if not already subed and merge in gb
                    setupPropSubs(tsoul)
                }
            }
        })
    }
    if(pathArgs[pathArgs.length -1][0] === 't' && pathArgs[pathArgs.length -1].length > 1){//find all columns on table && all rows
        let colPath = pathArgs.slice()
        colPath.push('r/p')
        colPath = colPath.join('/')
        let rowPath = pathArgs.slice()
        rowPath.push('r/p0')
        rowPath = rowPath.join('/')
        gun.get(colPath).on(function(gundata, id){
            let data = Gun.obj.copy(gundata)
            delete data['_']
            for (const pval in data) {
                const value = data[pval];
                if (value) {
                    let psoul = pathArgs.slice()
                    psoul.push('r')
                    psoul.push(pval)
                    psoul.push('config')
                    psoul = psoul.join('/')
                    handleGunSubConfig(psoul)//will sub if not already subed
                }
            }
        })
        handleGunSubConfig(rowPath)
    }

    
}
function handleGunSubConfig(subSoul){
    //will be table config, column config or p0 col for rows
    let p0col = subSoul.split('/')
    let configpath = configPathFromSoul(subSoul)
    let cachepath = cachePathFromSoul(subSoul)
    let base, tval, pval
    [base,tval,pval] = cachepath
    if(p0col[p0col.length-1] === 'p0'){//handle row case
        loadColDataToCache(base,tval,pval)
    }else{
        let configLoaded = getValue(configpath,gb)
        if(!configLoaded || configLoaded.alias === undefined){//create subscription
            gun.get(subSoul, function(msg,eve){//check for existence only
                eve.off()
                if(msg.put === undefined){
                    mergeConfigState({},subSoul)
                }
            })
            gun.get(subSoul).on(function(gundata, id){
                gunSubs[subSoul] = true
                let data = Gun.obj.copy(gundata)
                delete data['_']
                mergeConfigState(data,subSoul)
                rebuildGBchain(id)
            })
            
            
        }else{//do nothing, gun is already subscribed and cache is updating
    
        }
    }



}
function buildTablePath(baseID, tval){
    let colRes = []
    let rowRes = []
    let res = []
    const path = baseID + '/' + tval
    const tableConfig = gb[baseID].props[tval];
    let colgb = colRes[0] = {}
    let cola = colRes[1] = {}
    for (const p in tableConfig.props) {
        const palias = tableConfig.props[p].alias;
        let colpath = buildColumnPath(baseID, tval, p)
        colgb[p] = colpath
        cola[palias] = colpath
    }
    let rowgb = rowRes[0] = {}
    let rowa = rowRes[1] = {}
    if(tableConfig.rows){
        for (const gbid in tableConfig.rows) {
                const alias = tableConfig.rows[gbid];
                let rowpath = buildRowPath(gbid)
                rowgb[gbid] = rowpath
                rowa[alias] = rowpath
        }
    }
    setupGBalias(path)
    res[0] = Object.assign({}, colgb, rowgb, tableChainOpt(path))
    res[1] = Object.assign({}, cola, rowa, tableChainOpt(path), {_byAlias: true})
    return res
}
function buildColumnPath(baseID, tval, pval){
    let res
    const path = baseID + '/' + tval + '/' + pval
    setupGBalias(path)
    res = columnChainOpt(path)
    return res

}
function buildRowPath(rowID){
    let res
    const path = rowID
    res = rowChainOpt(path)
    setupGBalias(path)
    return res

}
function rebuildGBchain(path){
    //console.log('rebuilding gbase.chain from: ' + path)
    let res = {}
    for (const baseID in gb) {
        const baseConfig = gb[baseID];
        const baseAlias = baseConfig.alias
        res[baseID] = baseChainOpt(baseID)
        res[baseAlias] = baseChainOpt(baseID)
        for (const t in baseConfig.props) {
            let talias = baseConfig.props[t].alias
            let topts =  buildTablePath(baseID, t)
            res[baseID][t] = topts[0]
            res[baseID][talias] = topts[1]
            res[baseAlias][talias] = topts[1]
        }
        
    }
    res = Object.assign(res, gbaseChainOpt())
    for (const key in gbase) {//clear obj without losing reference
        if (gbase.hasOwnProperty(key)) {
            delete gbase[key]
        }
    }
    gbase = Object.assign(gbase,res)
    
    if(reactConfigCB && reactConfigCB.setState){
        let configObj = {}
        configObj.byAlias = gbByAlias(gb)
        configObj.forUI = gbForUI(gb)
        configObj.byGB = gb
        reactConfigCB.setState({config: configObj})
    }

}
function setupGBalias(gbasechainpath){
    let cpath = configPathFromChainPath(gbasechainpath)
    let gbvalue = getValue(cpath, gb)
    //console.log(cpath, gbvalue)
    if(gbvalue){
        if(!gb[gbasechainpath]){
            Object.defineProperty(gb,gbasechainpath, {
                get: function(){
                    return gbvalue
                }
            })
        }
    }
}

//CONFIG FUNCTIONS
const newBaseConfig = (config) =>{
    config = config || {}
    let alias = config.alias || 'New Base'
    let sortval = config.sortval || 0
    let vis = config.vis || true
    let archived = config.archived || false
    let deleted = config.deleted || false
    return {alias, sortval, vis, archived, deleted}
}
const newTableConfig = (config) =>{
    config = config || {}
    let alias = config.alias || 'New Table'
    let sortval = config.sortval || 0
    let vis = config.vis || true
    let archived = config.archived || false
    let deleted = config.deleted || false
    return {alias, sortval, vis, archived, deleted}
}
const newColumnConfig = (config) =>{
    config = config || {}
    let alias = config.alias || 'New Column'
    let sortval = config.sortval || 0
    let vis = config.vis || true
    let archived = config.archived || false
    let deleted = config.deleted || false
    let GBtype = config.GBtype || 'string' 
    let required = config.requred || false 
    let defaultval = config.defaultval || null 
    let fn = config.fn || "" 
    let usedIn = JSON.stringify({})
    let linksTo = config.linksTo || JSON.stringify({})
    let linkMultiple = config.linkMultiple || true
    return {alias, sortval, vis, archived, deleted, GBtype, required, defaultval, fn, usedIn, linksTo, linkMultiple}
}
const validGBtypes = {string: true, number: true, boolean: true, null: true, prev: true, next: true, function: true, tag: true, link: true} //link is not really valid, but is always handled
const checkConfig = (validObj, testObj) =>{//use for new configs, or update to configs
    //whichConfig = base, table, column, ..row?
    let nullValids = {string: true, number: true, boolean: true, null: true, object: false, function: false}
    let output
    for (const key in testObj) {
        if (validObj[key] !== undefined) {//key is valid
            const tTypeof = typeof testObj[key];
            const vTypeof = typeof validObj[key]
            if(vTypeof === null && !nullValids[tTypeof]){//wildcard check
                throw new Error('typeof value must be one of:', nullValids)
            }else if(vTypeof !== tTypeof){
                throw new Error(vTypeof+ ' !== '+ tTypeof)
            }
            if(key === 'GBtype' && validGBtypes[testObj[key]] === undefined ){//type check the column data type
                throw new Error('GBtype does not match one of:', Object.keys(validGBtypes))
            }
            return true
        }else{
            throw new Error(key + ' does not match valid keys of:', Object.keys(validObj))
        }
    }    
}
function mergeConfigState(gundata, gunsoul){
    let data = Gun.obj.copy(gundata)
    delete data['_']
    let configpath = configPathFromSoul(gunsoul)
    setMergeValue(configpath,data,gb)
}
function handleConfigChange(configObj, path, backLinkCol){
    //configObj = {alias: 'new name', sortval: 3, vis: false, archived: false, deleted: false}
    //this._path from wherever config() was called
    let cpath = configPathFromChainPath(path)
    let csoul = configSoulFromChainPath(path)
    let validConfig
    let tstamp = Date.now()
    let history = {}
    if(cpath[cpath.length-1][0] === 'p'){//col
        validConfig = newColumnConfig()
    }else if(cpath[cpath.length-1][0] === 't'){//table
        validConfig = newTableConfig()
    }else{//base (or row, but validConfig is not called)
        validConfig = newBaseConfig()
    }
    if(cpath[cpath.length-2] === 'props' || cpath.length === 1){//base,table,col config change
        try{
            checkConfig(validConfig, configObj)
            checkUniqueAlias(cpath, configObj.alias)
            checkUniqueSortval(cpath, configObj.sortval)
        }catch (e){
            return console.log(e)
        }
        if(configObj.GBtype){
            let linkstuff = {}
            for (const key in configObj) {//split config obj for normal configs vs type/link configs
                if(key === 'GBtype' || key === 'linksTo' || key === 'linkMultiple'){
                    linkstuff[key] = configObj[key]
                    delete configObj[key]
                }else{

                }
            }
            changeColumnType(path, linkstuff, backLinkCol)
        }
        if(Object.keys(configObj).length !== 0){
            history.old = oldConfigVals(cpath, configObj)
            history.new = configObj
            gun.get(csoul+'/history').get(tstamp).put(JSON.stringify(history))
            gun.get(csoul).put(configObj)
        }
    }else{//handle HID change
        //expects path argument of base/tval/rowid
        let checkAlias = (configObj.alias) ? checkUniqueAlias(cpath, configObj.alias) : false
        if(checkAlias){
            let chainpath = path.split('/')
            let rowID = chainpath[chainpath.length-1]
            //put data on p0 soul
            gun.get(path).get('p0').put(configObj.alias)
            gun.get(csoul).get(rowID).put(configObj.alias)
            let put = {p0: configObj.alias}
            handleRowEditUndo(path,put)            
        }else{
            return console.log('ERROR: New row alias is not unique')
        }
    }
    return true
}
function changeColumnType(path, configObj, backLinkCol){
    let [base, tval, pval] = path.split('/')
    let newType = configObj.GBtype
    if(pval[0] !== 'p'){
        return console.log('ERROR: Can only change GBtype of columns')
    }
    let cpath = configPathFromChainPath(path)
    let configCheck = newColumnConfig()
    let check = checkConfig(configCheck, {GBtype: newType})
    if(!check && newType !== 'link'){return console.log('Error: Invalid column type', newType)}
    let colParam = getValue(cpath,gb)
    if(colParam.GBtype === newType){
        return console.log('GBtype is already this type')
    }
    let colSoul = base + '/' + tval + '/r/' + pval
    
    if(newType === 'string' || newType === 'number' || newType === 'boolean'){//100% pass, or error and change nothing.
        let data = getValue([base,tval,pval], cache)
        console.log(data)
        if(!data){
            loadColDataToCache(base,tval,pval)
            setTimeout(changeColumnType, 100, path, configObj, backLinkCol)
            return
        }
        //forin keys and attempt to change values over
        //maybe just abort the conversion and alert user which cell(s) needs attention
        let putObj = {}
        if(newType === 'string'){
            for (const key in data) {
                putObj[key] = convertValueToType(data[key], 'string')
            }
        }else if(newType === 'number'){
            for (const key in data) {
                let HID = getValue([base, 'props', tval, 'rows', key], gb)
                const value = data[key];
                try{
                    putObj[key] = convertValueToType(value, 'number', HID) 
                }catch (e){
                    return console.log(e)
                }
            }
        }else if(newType === 'boolean'){
            for (const key in data) {
                let HID = getValue([base, 'props', tval, 'rows', key], gb)
                const value = data[key]
                try{
                    putObj[key] = convertValueToType(value, 'boolean', HID) 
                }catch (e){
                    return console.log(e)
                }
            }
        }
        gun.get(colSoul + '/config').get('GBtype').put(newType)
        gun.get(colSoul).put(putObj)
      //  })
    }else if (newType === 'link' || newType === 'prev' || newType === 'next'){//parse values for linking
        //initial upload links MUST look like: "HIDabc, HID123" spliting on ", "
        let [linkBase, linkTval, linkPval] = (configObj.linksTo) ? configObj.linksTo.split('/') : [false,false,false]
        let [backLBase, backLTval, backLPval] = (backLinkCol) ? backLinkCol.split('/') : [false,false,false]
        if(configObj.linksTo && getValue([linkBase,'props',linkTval, 'props', linkPval], gb)){//check linksTo is valid table
            if(backLinkCol && !getValue([backLBase,'props',backLTval, 'props', backLPval], gb)){//if backLinkCol specified, validate it exists
                return console.log('ERROR-Aborted Linking: Back link column ['+backLinkCol+ '] on sheet: ['+ linkRowTo + '] Not Found')
            }
            handleLinkColumn(path, configObj, backLinkCol) 
        }else{
            return console.log('ERROR: config({linksTo: '+configObj.linksTo+' } is either not defined or invalid')
        }            
    }else{
        return console.log('ERROR: Cannot understand what GBtype')
    }
    
}
function oldConfigVals(pathArr, configObj){
    let oldObj = {}
    let config = getValue(pathArr, gb)
    for (const key in configObj) {
        oldObj[key] = config[key]
    }
    return oldObj
}

//GBASE UTIL FUNCTIONS
function cachePathFromSoul(soul){//should redo with regex
    let pathArgs = soul.split('/')
    if(pathArgs[pathArgs.length -1] === 'config'){
        pathArgs.pop()
    }
    if(pathArgs.length === 3){//add .rows to path before rval
        pathArgs.splice(2,0, 'rows')
     }
    if(pathArgs.length === 4){//move r in path
       let rval = pathArgs.splice(2,1)
        if(rval.length > 1){
            pathArgs.push(rval)
        }
    }
    return pathArgs

}
function cachePathFromChainPath(thisPath){//should redo with regex
    let pathArgs = thisPath.split('/')
    if(pathArgs.length === 3){//add .rows to path before rval
        pathArgs.splice(2,0, 'rows')
     }
    if(pathArgs.length === 4){//move r in path
       let rval = pathArgs.splice(2,1)
        if(rval.length > 1){
            pathArgs.push(rval)
        }
    }
    return pathArgs

}
function configPathFromSoul(soul){//should redo with regex
    let pathArgs = soul.split('/')
    let config = false
    if(pathArgs[pathArgs.length -1] === 'config'){
        pathArgs.pop()
        config = true
    }
    if(pathArgs.length > 2){//remove r in path
       pathArgs.splice(2,1)
    }
    let configpath= []
    
    if(pathArgs.length > 1){
        for (let i = 0; i < pathArgs.length; i++) {
            const path = pathArgs[i];
            if(i === pathArgs.length-1){//end of path, our config
                if(config){
                    configpath.push(path)
                }else if(pathArgs[pathArgs.length -1] === 'p0' && !config){//handle rows
                    configpath.push('rows')
                }
            }else if (i === pathArgs.length-2 && pathArgs[pathArgs.length -1] === 'p0' && !config){
                configpath.push(path)
            }else{
                configpath.push(path)
                configpath.push('props')
            }
            
        }
    }else{
        configpath = pathArgs
    }
    return configpath

}
function configPathFromChainPath(thisPath){//should redo with regex
    let pathArgs = thisPath.split('/')
    let configpath= []
    let rowPath = false
    if(pathArgs.length > 1){//not base config
        for (let i = 0; i < pathArgs.length; i++) {
            let nextPath = pathArgs[i+1]
            const path = pathArgs[i];
            if(i === pathArgs.length-1 && !rowPath){//end of path, non row
                configpath.push(path)
            }else if(i === pathArgs.length-1 && rowPath){//end of path for a row
                configpath.push(thisPath)
            }else if (nextPath[0] === 'r' && nextPath.length >1){//if this path is a row push tval then 'rows'
                rowPath = true
                configpath.push(path)
                configpath.push('rows')
            }else{
                configpath.push(path)
                configpath.push('props')
            }
        }
    }else{
        configpath = pathArgs
    }
    return configpath

}
function configSoulFromChainPath(thisPath){//should redo with regex
    let pathArgs = thisPath.split('/')
    
    if(pathArgs[pathArgs.length -1][0] === 'p'){//insert /r/
       pathArgs.splice(2,0, 'r')
    }else if(pathArgs[pathArgs.length -1][0] === 'r' && pathArgs[pathArgs.length -1].length > 1){
        pathArgs.splice(2,pathArgs.length, 'r/p0') //p0 soul for table
    }
    if(pathArgs[pathArgs.length -1] !== 'config'){
        pathArgs.push('config')
    }
    return pathArgs.join('/')

}
const findID = (obj, name) =>{//obj is level above .props, input human name, returns t or p value
    let first = name[0]
    let rest = name.slice(1)
    if(first === 'p' && !isNaN(rest *1)){//if name is a pval just return the name
        return name
    }
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const alias = obj[key].alias;
            if(alias === name){
                return key
            }
        }
    }
    return false
}
const findRowID = (obj, name) =>{//obj is .rows, input human name, returns rowID
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const alias = obj[key]
            if(alias === name){
                return key
            }
        }
    }
    return false
}
const findRowAlias = (rowID) =>{//obj is .rows, input human name, returns rowID
    let [base, tval] = rowID.split('/')
    let obj = getValue([base, 'props',tval,'rows'],gb)
    return obj[rowID]
}
const gbForUI = (gb) =>{
    let output = {}
    for (const bid in gb) {
        output[bid] = {}
        const tableobj = Gun.obj.copy(gb[bid].props);
        for (const tval in tableobj) {
            let tvis = tableobj[tval].vis
            if(tvis){
                let tsort = tableobj[tval].sortval
                output[bid][tsort] = {[tval]: {}}

                for (const pval in tableobj[tval].props) {
                    const pconfig = tableobj[tval].props[pval];
                    if(pconfig.vis){
                        let psort = pconfig.sortval
                        output[bid][tsort][tval][psort] = pval
                    }
                }
            }
        }

    }
    return output
}
const gbByAlias = (gb) =>{
    let output = Gun.obj.copy(gb)
    for (const bid in gb) {
        const tableobj = Gun.obj.copy(gb[bid].props);
        for (const tval in tableobj) {
            let tconfig = tableobj[tval]
            //byAlias
            let talias = tconfig.alias
            let prev = output[bid].props[tval]
            let newdata = Object.assign({},prev)
            newdata.alias = tval
            output[bid].props[talias] = newdata
            delete output[bid].props[tval]
            delete output[bid].props[talias].rows
            if(tconfig.rows){//Invert Key/Values in HID Alias obj
                for (const rowID in tconfig.rows) {
                    if (tconfig.rows[rowID]) {
                        const GBalias = tconfig.rows[rowID];
                        setValue([bid,'props',talias,'rows', GBalias], rowID, output)
                        output[bid].props[talias].rows[GBalias] = rowID
                    }
                }
            }

            const columnobj = Gun.obj.copy(tableobj[tval].props);
        
            for (const pval in columnobj) {
                const palias = columnobj[pval].alias;
                let prev = output[bid].props[talias].props[pval]
                let newdata = Object.assign({},prev)
                newdata.alias = pval
                output[bid].props[talias].props[palias] = newdata
                delete output[bid].props[talias].props[pval]
            }
        }

    }
    return output
}
function linkColPvals(base,tval){
    let obj = getValue([base,'props',tval,'props'], gb)
    let result = {}
    for (const key in obj) {
        if (obj[key].linksTo && obj[key].GBtype === 'prev' || obj[key].GBtype === 'next') {
            const link = obj[key].linksTo
            result[key] = link
        }
    }
    return result
}
function setValue(propertyPath, value, obj){
    let properties = Array.isArray(propertyPath) ? propertyPath : propertyPath.split("/")
    if (properties.length > 1) {// Not yet at the last property so keep digging
      // The property doesn't exists OR is not an object (and so we overwritte it) so we create it
      if (!obj.hasOwnProperty(properties[0]) || typeof obj[properties[0]] !== "object") obj[properties[0]] = {}
        // We iterate.
      return setValue(properties.slice(1), value, obj[properties[0]])
        // This is the last property - the one where to set the value
    } else {
      // We set the value to the last property
        obj[properties[0]] = value
      return true // this is the end
    }
}
function setMergeValue(propertyPath, value, obj){
    let properties = Array.isArray(propertyPath) ? propertyPath : propertyPath.split("/")
    if (properties.length > 1) {// Not yet at the last property so keep digging
      // The property doesn't exists OR is not an object (and so we overwritte it) so we create it
      if (!obj.hasOwnProperty(properties[0]) || typeof obj[properties[0]] !== "object") obj[properties[0]] = {}
        // We iterate.
      return setMergeValue(properties.slice(1), value, obj[properties[0]])
        // This is the last property - the one where to set the value
    } else {
      // We set the value to the last property
      if(typeof value === 'object'){
        if (!obj.hasOwnProperty(properties[0]) || typeof obj[properties[0]] !== "object") obj[properties[0]] = {}
        obj[properties[0]] = Object.assign(obj[properties[0]], value)
      }else{
        obj[properties[0]] = value
      }
      return true // this is the end
    }
}
function getValue(propertyPath, obj){
    let properties = Array.isArray(propertyPath) ? propertyPath : propertyPath.split("/")
    if (properties.length > 1) {// Not yet at the last property so keep digging
      if (!obj.hasOwnProperty(properties[0])){
          return undefined
      }
      return getValue(properties.slice(1), obj[properties[0]])
    }else{
        return obj[properties[0]]
    }
}
function validateData(editThisPath, putObj){//prunes specials
    let args = editThisPath.split('/')
    let output = {}
    for (const pval in putObj) {
        let value = putObj[pval]
        let GBtype = getValue([args[0],'props', args[1], 'props', pval, 'GBtype'], gb)
        if(GBtype === undefined){
            let colname = getValue([args[0],'props', args[1], 'props', pval, 'alias'], gb)
            return console.log('ERROR: Cannot find data type for column: '+ colname+'['+ pval+'].')
        }
        let specials = {prev: 'string', next: 'string', function: 'string', tag: 'string'}
        if(specials[GBtype] === undefined){//root data type
            if(typeof value === GBtype){
                output[pval] = value
            }else{
                console.log('ERROR: typeof '+ value + 'is not of type '+ GBtype)
                return false
            }
        }
    }
    return output
}
function handleRowEditUndo(gbpath, editObj){
    //gbpath should = base/tval/rowid
    //editObj = {p0: 'value, p4: 'other value', etc..}
    let arrpath = gbpath.split('/')
    let tstamp = Date.now()
    let undo = {}
    undo._path = gbpath
    undo.put = editObj
    let entry = {[tstamp]: undo}
    let curhist = getValue([arrpath[0], 'history'], gb)
    let fullList = (curhist) ? Object.assign({},curhist,entry) : entry
    let lenCheck = Object.keys(fullList)
    if(lenCheck.length > 100){
        delete fullList[lenCheck[0]]
    }
    gun.get(arrpath[0] + '/state').get('history').put(JSON.stringify(fullList))
    //node undo
    gun.get(gbpath + '/history').get(tstamp).put(JSON.stringify(undo.put))   
}
function checkUniqueAlias(pathArr, alias){
    let configPath = pathArr.slice()
    let endPath = configPath.pop()//go up one level
    let things = getValue(configPath, gb)
    if(pathArr.length === 1){
        return true //base alias, those are not unique
    }
    if(things !== undefined){
        if(endPath[0] !== 'r'){//base/table/col
            for (const gbval in things) {
                const configObj = things[gbval];
                if (configObj && configObj.alias && configObj.alias === alias && gbval !== endPath) {
                    throw new Error('Matching Alias found at:', gbval)
                }
            }
        }else{//row
            for (const gbval in things) {
                const rowAlias = things[gbval];
                if (rowAlias && rowAlias === alias && gbval !== endPath) {
                    throw new Error('Matching Alias found at:', gbval)
                }
            }
        }
        return true
    }else{
        throw new Error('Cannot find config data at path:', configPath)
    }
}
function checkUniqueSortval(pathArr, sortval){
    let configPath = pathArr.slice()
    let endPath = configPath.pop()//go up one level
    let things = getValue(configPath, gb)
    if(configPath.length === 1){
        return true //base alias, those are not unique
    }
    if(things !== undefined){
        if(endPath[0] !== 'r'){//base/table/col
            for (const gbval in things) {
                const configObj = things[gbval];
                if (configObj && configObj.sortval && configObj.sortval === sortval && gbval !== endPath) {
                    throw new Error('Matching sortval found at:', gbval)
                }
            }
        }else{//row
            //no sort on row
        }
        return true
    }else{
        throw new Error('Cannot find config data at path:', configPath)
    }
}
function findNextID(path){
    let curIDsPath = configPathFromChainPath(path)
    curIDsPath.push('props')
    let curIDs = getValue(curIDsPath, gb)
    let tOrP = Object.keys(curIDs)[0][0]
    if(curIDs !== undefined){
        let ids = Object.keys(curIDs).map(id=>id.slice(1)*1)
        let nextid = tOrP + (Math.max(...ids)+1)
        return nextid
    }
}
function nextSortval(path){
    let curIDsPath = configPathFromChainPath(path)
    curIDsPath.push('props')
    let curIDs = getValue(curIDsPath, gb)
    let nextSort = 0
    for (const key in curIDs) {
        const sortval = curIDs[key].sortval;
        console.log(sortval, nextSort)
        if(sortval && sortval >= nextSort){
            nextSort = sortval
        }
    }
    nextSort += 10
    return nextSort
}
function convertValueToType(value, newType, rowAlias){
    let out
    if(newType === 'string'){
        out = String(value)
    }else if(newType === 'number'){
        let num = value*1
        if(isNaN(num)){
            throw new Error('Conversion aborted. Cannot convert '+ value + ' for '+ rowAlias + ' to a number. Fix and try again')
        }else{
            out = num
        }
    }else if(newType === 'boolean'){
        value = String(value)
        if(value == '' || '0' || 'false' || 'null' || 'undefined' || ""){//falsy strings
            out = false
        }else if (value == '1' || 'true' || 'Infinity'){//truthy strings
            out = true
        }else{
            throw new Error('Conversion aborted. Cannot convert '+ value + ' for '+ rowAlias + ' to boolean. enter true or false or 0 for false or 1 for true')
        }
    }else{
        throw new Error('Can only attempt to conver value to "string", "number", or "boolean" using this function')
    }
    return out
}
function isLinkMulti(colStr){
    let cpath = configPathFromChainPath(colStr)
    let config = getValue(cpath,gb) || {}
    if(config.linkMultiple && (config.GBtype === 'prev' || config.GBtype === 'prev')){
        return true
    }
    return false
}
function getColumnType(colStr){
    let cpath = configPathFromChainPath(colStr)
    let config = getValue(cpath,gb) || {}
    if(config.GBtype !== undefined){
        return config.GBtype
    }
    return false
}

//GBASE CHAIN COMMANDS
function newBase(alias, tname, pname, baseID){
    if(baseID === undefined){
        baseID = 'B' + Gun.text.random(4)   
    }
    gun.get('GBase').put({[baseID]: true})
    gun.get(baseID + '/config').put(newBaseConfig({alias}))
    gun.get(baseID + '/t0/config').put(newTableConfig({alias: tname}))
    gun.get(baseID + '/t0/r/p0/config').put(newColumnConfig({alias: pname}))   
    gun.get(baseID + '/t0/r/p').put({p0: true})
    gun.get(baseID + '/t').put({t0: true})
    return baseID
}
function newTable(tname, pname){
    let path = this._path
    let nextT = findNextID(path)
    let tconfig = newTableConfig({alias: tname, sortval: nextSortval(path)})
    let pconfig = newColumnConfig({alias: pname})
    gun.get(path + '/' + nextT + '/config').put(tconfig)
    gun.get(path + '/' + nextT + '/r/p0/config').put(pconfig)
    gun.get(path + '/t').put({[nextT]: true})
    gun.get(path + '/' + nextT + '/r/p').put({p0: true})
}
function newColumn(pname, type){
    let path = this._path
    let nextP = findNextID(path)
    let pconfig = newColumnConfig({alias: pname, GBtype: type, sortval: nextSortval(path)})
    let typeCheck = checkConfig(newColumnConfig(), pconfig)
    if(typeCheck){
        gun.get(path + '/r/' + nextP + '/config').put(pconfig)
        gun.get(path + '/r/p').put({[nextP]: true})
    }else{
        return console.log('ERROR: invalid type give: '+ type)
    }
    return nextP
}
function newRow(alias, data){
    if(alias === undefined || typeof alias === 'object'){
        return console.log('ERROR: You must specify an alias for this column, you supplied: '+ alias)}
    let tpath = this._path
    let newAlias = (this._alias) ? this._alias : false
    let _byAlias = (this._byAlias) ? true : false
    let id = 'r' + Gun.text.random(6)
    let fullpath = tpath + '/' + id
    let rowpath = configPathFromChainPath(fullpath)
    let aliasCheck = checkUniqueAlias(rowpath, alias)
    let call = {_path: fullpath , _newRow: true, _byAlias, _alias: alias, edit}
    if(aliasCheck){
        call.edit(data)
    }else{
        return console.log('ERROR: [ ' + alias + ' ] is not a unique row name on this table')
    }
    //edit.call(this, data)
}
function linkColumnTo(linkTableOrBackLinkCol){
    let path = this._path
    if(path.split('/')[2]==='p0'){return console.log("ERROR: Cannot use the first column to link another table")}
    let cpath = configPathFromChainPath(path)
    let colType = getValue(cpath, gb).GBtype
    let configObj = {}
    if(!colType){return console.log("ERROR: Cannot find the type of this column")}
    if(colType === 'prev' || colType === 'next'){
        return console.log('ERROR: Column is already a link column, to add more links, use "linkRowTo()"')
    }else{
        configObj.GBtype = 'link'
    }
    if(typeof linkTableOrBackLinkCol === 'object'){
        linkTableOrBackLinkCol = linkTableOrBackLinkCol._path || undefined
    }
    if(linkTableOrBackLinkCol === undefined){return console.log('ERROR: Must pass in a gbase[baseID][tval] or the column with the recipricol links')}
    configObj.linksTo = linkTableOrBackLinkCol
    let linkPath = linkTableOrBackLinkCol.split('/')
    if(linkPath.length === 2 || linkPath.length === 3 && linkPath[2] === 'p0'){//table or table key column
        handleConfigChange(configObj, path, undefined)
    }else{// it is assumed to be the actual backlinkcolumn
        handleConfigChange(configObj, path, linkTableOrBackLinkCol)
    }
}
function config(configObj, backLinkCol){
    let path = this._path
    handleConfigChange(configObj, path, backLinkCol)
}
function edit (editObj){
    let path = this._path
    let newRow = (this._newRow) ? true : false
    let aliasCol = (this._byAlias) ? true : false
    let args = path.split('/')
    let base = args[0]
    let tval = args[1]
    let tpath = configPathFromChainPath([base,tval].join('/'))
    let ppath = tpath.slice()
    let checkTable = getValue(tpath, gb)
    ppath.push('props')
    let cols = getValue(ppath, gb)
    let putObj = {}
    //parse meaning of non config edit
    if (checkTable !== undefined) {//valid base and table
        //check keys in putObj for valid aliases && check values in obj for correct type in schema then store GB pname
        if(aliasCol){
            for (const palias in editObj) {
                let pval = findID(cols, palias)
                if (pval) {
                    putObj[pval] = editObj[palias]; 
                }else{
                    return console.log('ERROR: Cannot find column with name [ '+ palias +' ]. Edit aborted')
                }
            }
        }else{
            putObj = editObj
        }
        let validatedObj = validateData(path,putObj) //strip prev, next, tags, fn keys, check typeof on rest
        if(!validatedObj){return}
        console.log(validatedObj)
        for (const key in validatedObj) {
            let colSoul = base + '/' + tval + '/r/' + key
            const value = validatedObj[key];
            if(key !== 'p0'){//put non-row name changes
                gun.get(colSoul).get(path).put(value)
            }else if(key === 'p0' && !newRow){
                //check uniqueness
                let rowpath = configPathFromChainPath(path)
                let aliasCheck = checkUniqueAlias(rowpath, alias)
                if(aliasCheck){
                    gun.get(colSoul).get(path).put(value)
                }
            }else if(newRow && newAlias){
                //new row, uniqueness already checked
                gun.get(colSoul).get(path).put(newAlias)
            }         
        }
        handleRowEditUndo(path,validatedObj)
    }else{
        return console.log('Cannot find base:[ '+ base +' ] and/or table: '+ tval)
    }
}
function subscribe(callBack, colArr, onlyVisible, notArchived, udSubID){
    if(typeof callBack !== 'function'){return console.log('ERROR: Must pass a function as a callback')}

    if(onlyVisible === undefined){//default, only subscribe/return to items that are both visible and not archived, UI basically
        onlyVisible = true //false would subscribe/return hidden columns as well
    }
    if(notArchived === undefined){
        notArchived = true //false would subscribe/return archived columns
    }

    let path = this._path //could be base/tval || base/tval/pval(colArr is invalid for this opt) || base/tval/rowid
    let pathArgs = path.split('/')
    let subID = udSubID || Gun.text.random(6)
    let base = pathArgs[0]
    let tval = pathArgs[1]
    let pval, rowid, level, objKey

    if(pathArgs.length === 2){
        level = 'table'
    }else if(pathArgs.length === 3 && pathArgs[2][0] === 'r'){
        level = 'row'
    }else{
        level = 'column'
    }
    let columns = []
    if(level !== 'column'){
        let cols = getValue([pathArgs[0], 'props', pathArgs[1], 'props'], gb)
        if(colArr){// check for pvals already, or attemept to convert col array to pvals
            for (let j = 0; j < colArr.length; j++) {
                const col = colArr[j];
                if(col[0] === 'p' && col.slice(1)*1 > -1){//if col is 'p' + [any number] then already pval
                    columns.push(col)
                }else{
                    let pval = findID(cols, col)
                    if(pval !== undefined && cols[pval].vis === onlyVisible && !cols[pval].archived === notArchived && !cols[pval].deleted){
                        columns.push(pval)
                    }else{
                        console.log('ERROR: Cannot find column with name: '+ col)
                    }
                }
            }
        }else{//full object columns
            for (const colp in cols) {
                if(cols[colp].vis === onlyVisible && !cols[colp].archived === notArchived && !cols[colp].deleted){
                    columns.push(colp)
                }
            }
        }
    }
    let colsString
    if(Array.isArray(columns)){colsString = columns.join(',')}
    let tstring = base +'/' + tval + '/'
    //with filtered column list, generate configs from given args
    if(level === 'row'){//row path
        rowid = pathArgs[2]
        if(colArr !== undefined){
            objKey = tstring + rowid + '/' + colsString + '-' + subID
        }else{
            objKey = tstring + rowid + '/' + 'ALL-' + subID
        }
    }else if(level === 'column'){//column path
        pval = pathArgs[2]
        objKey = tstring + 'r/' + pval + '-' + subID
    }else{//table path
        rowid = false
        pval = false
        if(colArr !== undefined){
            objKey = tstring  + colsString + '-' + subID
        }else{
            objKey = tstring + 'ALL-' + subID
        }
    }
    if(typeof gsubs[base] !== 'object'){
        gsubs[base] = new watchObj()
    }
    if(!gsubs[base][objKey]){
        gsubs[base].watch(objKey,callBack)//should fire CB on update
        let cached = requestInitialData(path,columns,level)//returns what is in cache, sets up gun subs that are missing
        gsubs[base][objKey] = cached //should fire off with user CB?
    }
}
function retrieve(colArr){
    let path = this._path //should be base/tval/rowid
    let pathArgs = path.split('/')
    let cols = getValue([pathArgs[0], 'props', pathArgs[1], 'props'], gb)
    let rowid = pathArgs[2]
    let results = {}
    let columns = []
    if(colArr){// check for pvals already, or attemept to convert col array to pvals
        for (let j = 0; j < colArr.length; j++) {
            const col = colHeaders[j];
            if(col[0] === 'p' && col.slice(1)*1){//if col is 'p' + [any number] then already pval
                columns.push(col)
            }else{
                let pval = findID(cols, col)
                if(pval !== undefined){
                    columns.push(pval)
                }else{
                    console.log('ERROR: Cannot find column with name: '+ col)
                }
            }
        }
    }else{//full object columns
        for (const colp in cols) {
            if(!cols[colp].archived || !cols[colp].deleted){
                columns.push(colp)
            }
        }
    }
    console.log(path)
    return getRow(path, columns, 0)

}
function linkRowTo(rowLinkCol, gbaseGetRow){
    //gbaseGetRow = gbase[base][tval][rowID]
    let path = this._path
    let colsPath = path.split('/')
    colsPath.pop()
    colsPath.push('props')
    let cols = getValue(colsPath,gb)
    let pval = findRowID(cols,rowLinkCol)

    if(args.BYGB){//convert t and p args to what other API's expect
        if(args.base && args.t && !args.p){
            args.t = GB.byGB[args.base].props[args.t].alias //tname
        }
        if(args.base && args.t && args.p){
            args.p = GB.byGB[args.base].props[args.t].props[args.p].alias//pname
            args.t = GB.byGB[args.base].props[args.t].alias //tname
        }
    }
    let targetLink = gbaseGetRow._path
}

//STATIC CHAIN OPTS
function gbaseChainOpt(){
    return {newBase, showgb, showcache, showgsub, showgunsub, solve}
}
function baseChainOpt(_path){
    return {_path, config, newTable, importNewTable}
}
function tableChainOpt(_path){
    return {_path, config, newRow, newColumn, importData, subscribe}
}
function columnChainOpt(_path){
    return {_path, config, subscribe, linkColumnTo}
}
function rowChainOpt(_path){
    return {_path, edit, retrieve, subscribe}
}

//FUNCTION STUFF
function solve(rowID, eq){
    let linksResolved
    let logicResolved
    let output
    try{//substitue links with the value they represent
        linksResolved = getLinks(rowID, eq)
        if(!linksResolved){
            setTimeout(solve,1000,rowID, eq)
            return
        }
    }catch(e){
        return console.log(e)
    }
    try{//parse string for comparators/ifs/etc
        logicResolved = evaluateAllFN(eq)
    }catch(e){
        return console.log(e)
    }
    let containsInvalidChars = /[^()+\-*/0-9.\s]/gi.test(logicResolved);
    if(!containsInvalidChars){
        let solver = new MathSolver()
        try{
            output = solver.solve(logicResolved)
        }catch(e){
            return console.log(e)
        }
        console.log(output)
        return output
    }else{
        let cleaned = stripDoubleQuotes(logicResolved)
        return cleaned
    }
    
}
function MathSolver() {

    this.infixToPostfix = function(infix) {
        var outputQueue = "";
        var operatorStack = [];
        var operators = {
            "^": {
                precedence: 4,
                associativity: "Right"
            },
            "/": {
                precedence: 3,
                associativity: "Left"
            },
            "*": {
                precedence: 3,
                associativity: "Left"
            },
            "+": {
                precedence: 2,
                associativity: "Left"
            },
            "-": {
                precedence: 2,
                associativity: "Left"
            }
        }
        infix = infix.replace(/\s+/g, "");
        infix = clean(infix.split(/([\+\-\*\/\^\(\)])/))
        for(var i = 0; i < infix.length; i++) {
            var token = infix[i];
            if(isNumeric(token)) {
                outputQueue += token + " ";
            } else if("^*/+-".indexOf(token) !== -1) {
                var o1 = token;
                var o2 = operatorStack[operatorStack.length - 1];
                while("^*/+-".indexOf(o2) !== -1 && ((operators[o1].associativity === "Left" && operators[o1].precedence <= operators[o2].precedence) || (operators[o1].associativity === "Right" && operators[o1].precedence < operators[o2].precedence))) {
                    outputQueue += operatorStack.pop() + " ";
                    o2 = operatorStack[operatorStack.length - 1];
                }
                operatorStack.push(o1);
            } else if(token === "(") {
                operatorStack.push(token);
            } else if(token === ")") {
                while(operatorStack[operatorStack.length - 1] !== "(") {
                    outputQueue += operatorStack.pop() + " ";
                }
                operatorStack.pop();
            }
        }
        while(operatorStack.length > 0) {
            outputQueue += operatorStack.pop() + " ";
        }
        return outputQueue;
    }
    this.solvePostfix = function postfixCalculator(expression) {
        if (typeof expression !== 'string') {
          if (expression instanceof String) {
            expression = expression.toString();
          } else {
            return null;
          }
        }
    
        var result;
        var tokens = expression.split(/\s+/);
        var stack = [];
        var first;
        var second;
        var containsInvalidChars = /[^()+\-*/0-9.\s]/gi.test(expression);
    
        if (containsInvalidChars) {
          return null;
        }
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (token === '*') {
                second = stack.pop();
                first = stack.pop();
        
                if (typeof first === 'undefined') {
                first = 1;
                }
        
                if (typeof second === 'undefined') {
                second = 1;
                }
        
                stack.push(first * second);
            } else if (token === '/') {
                second = stack.pop();
                first = stack.pop();
                stack.push(first / second);
            } else if (token === '+') {
                second = stack.pop();
                first = stack.pop();
                stack.push(first + second);
            } else if (token === '-') {
                second = stack.pop();
                first = stack.pop();
                stack.push(first - second);
            } else {
                if (isNumeric(token)) {
                stack.push(Number(token));
                }
            }
        }
    
        result = stack.pop();
    
        return result;
    }
    this.infixToPostfixCompare = function(infix) {
        infix = this.swapOperators(infix)
        var outputQueue = "";
        var operatorStack = [];
        var operators = {
            "^": {
                precedence: 4,
                associativity: "Right"
            },
            "/": {
                precedence: 3,
                associativity: "Left"
            },
            "*": {
                precedence: 3,
                associativity: "Left"
            },
            "+": {
                precedence: 2,
                associativity: "Left"
            },
            "G": {
                precedence: 1,
                associativity: "Left"
            },
            "L": {
                precedence: 1,
                associativity: "Left"
            },
            "E": {
                precedence: 1,
                associativity: "Left"
            },
            "N": {
                precedence: 1,
                associativity: "Left"
            },
            "P": {
                precedence: 1,
                associativity: "Left"
            },
            "M": {
                precedence: 1,
                associativity: "Left"
            }
        }
        infix = infix.replace(/\s+/g, "");
        infix = clean(infix.split(/([\+\-\*\/\^\(\)GLENPM])/))
        for(var i = 0; i < infix.length; i++) {
            var token = infix[i];
            if(isNumeric(token)) {
                outputQueue += token + " ";
            } else if("^*/+-GLENPM".indexOf(token) !== -1) {
                var o1 = token;
                var o2 = operatorStack[operatorStack.length - 1];
                while("^*/+-GLENPM".indexOf(o2) !== -1 && ((operators[o1].associativity === "Left" && operators[o1].precedence <= operators[o2].precedence) || (operators[o1].associativity === "Right" && operators[o1].precedence < operators[o2].precedence))) {
                    outputQueue += operatorStack.pop() + " ";
                    o2 = operatorStack[operatorStack.length - 1];
                }
                operatorStack.push(o1);
            } else if(token === "(") {
                operatorStack.push(token);
            } else if(token === ")") {
                while(operatorStack[operatorStack.length - 1] !== "(") {
                    outputQueue += operatorStack.pop() + " ";
                }
                operatorStack.pop();
            }
        }
        while(operatorStack.length > 0) {
            outputQueue += operatorStack.pop() + " ";
        }
        return outputQueue;
    }
    this.swapOperators = function(infix){
        infix = infix.replace(/<=/g, 'M')
        infix = infix.replace(/>=/g, 'P')
        infix = infix.replace(/!=/g, 'P')
        infix = infix.replace(/>/g, 'G')
        infix = infix.replace(/</g, 'L')
        infix = infix.replace(/=/g, 'E')
        return infix
    }
    this.evaluatePostfix = function (expression) {
        if (typeof expression !== 'string') {
          if (expression instanceof String) {
            expression = expression.toString();
          } else {
            return null;
          }
        }
    
        var result;
        var tokens = expression.split(/\s+/);
        var stack = [];
        var first;
        var second;
        var containsInvalidChars = /[^()+\-*/0-9.\sGLENPM]/g.test(expression);
        if (containsInvalidChars) {
          return null;
        }
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if("GLENPM".indexOf(token) !== -1){//should always be only one, at end of stack
                second = stack.pop()
                first = stack.pop()
                if(token === 'G'){
                    if(first > second){
                        return true
                    }else{
                        return false
                    }
                }
                if(token === 'L'){
                    if(first < second){
                        return true
                    }else{
                        return false
                    }
                }
                if(token === 'E'){
                    if(first === second){
                        return true
                    }else{
                        return false
                    }
                }
                if(token === 'N'){
                    if(first !== second){
                        return true
                    }else{
                        return false
                    }
                }
                if(token === 'P'){
                    if(first >= second){
                        return true
                    }else{
                        return false
                    }
                }
                if(token === 'M'){
                    if(first <= second){
                        return true
                    }else{
                        return false
                    }
                }
            }
            if (token === '*') {
                second = stack.pop();
                first = stack.pop();
        
                if (typeof first === 'undefined') {
                first = 1;
                }
        
                if (typeof second === 'undefined') {
                second = 1;
                }
        
                stack.push(first * second);
            } else if (token === '/') {
                second = stack.pop();
                first = stack.pop();
                stack.push(first / second);
            } else if (token === '+') {
                second = stack.pop();
                first = stack.pop();
                stack.push(first + second);
            } else if (token === '-') {
                second = stack.pop();
                first = stack.pop();
                stack.push(first - second);
            } else {
                if (isNumeric(token)) {
                stack.push(Number(token));
                }
            }
        }
    
        result = stack.pop();
    
        return result;
    }
    this.solveAndCompare = function(infix){
        let pf = this.infixToPostfixCompare(infix)
        return this.evaluatePostfix(pf)
    }
    this.solve = function(infix){
        let pf = this.infixToPostfix(infix)
        return this.solvePostfix(pf)
    }
}
function isNumeric(value){
    return !isNaN(parseFloat(value)) && isFinite(value);
}
function clean(arr){
    for(var i = 0; i < arr.length; i++) {
        if(arr[i] === "") {
            arr.splice(i, 1);
        }
    }
    return arr;
}
function regexEscape(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}
function regexVar(reg,literal,flags){
    //reg: regex with any fixed literals escaped, NO /   /  ~ represents where the literal goes in
    //literal: non escaped exact match characters
    //flags: 'g' or 'gi' , etc..
    let fullr = reg.replace('~', regexEscape(literal))
    let r = new RegExp(fullr,flags)
    return r
}
//FUNCTION POST LINK PARSING, PRE-SOLVE PARSING
function evaluateAllFN(linkSubedFNstring){
    let r = /[A-Z]+(?=\(.+?\))/g
    let match = r.exec(linkSubedFNstring)
    let resolvedArgs = []
    if(!match){//no functions in this string
        return linkSubedFNstring
    }
    if(!gfn[match[0]]){
        throw new Error('Invalid Function: '+ match[0])
    }
    let find = findFN(linkSubedFNstring, match.index)
    let argsArr = findFNArgs(find)
    for (let i=0; i<argsArr.length; i++){
        let val = argsArr[i]
        let more = r.exec(val)
        if(more){//arg contains a FN
            resolvedArgs.push(evaluateAllFN(val))
        }else{
            resolvedArgs.push(val)
        }
    }
    let result = gfn[match[0]](resolvedArgs)
    linkSubedFNstring = linkSubedFNstring.replace(find,result)
    linkSubedFNstring = evaluateAllFN(linkSubedFNstring)
    return linkSubedFNstring
}

//FUNCTION UTILS
function findFN(str,startIdx){
    let left = []
    let right = []
    let endIdx
    for (let i=startIdx; i<str.length; i++){
      let tok = str[i]
      if(tok === '('){
        left.push(tok)
      }else if(tok === ')'){
        right.push(tok)
      }
      if(left.length && left.length === right.length){
        endIdx = i + 1
        break
      }
    }
    return str.slice(startIdx, endIdx)
}
function findFNArgs(str){
    let left = []
    let right = []
    let leftPar
    let rightPar
    let comIdx = []
    for (let i=0; i<str.length; i++){
        let tok = str[i]
        if(tok === '('){
        left.push(tok)
            if(left.length === 1){
                leftPar = i
            }
        }else if(tok === ')'){
            right.push(tok)
            if(left.length === right.length){
                rightPar = i
            }
        }
        if(left.length && left.length === right.length + 1 && tok ===','){
        comIdx.push(i)
        }
    }
    let args = []
    let next
    for (let i = 0; i < comIdx.length; i++) {
        const com = comIdx[i];
        if(i === 0){
            args.push(str.slice(leftPar+1,com))
            next = com + 1
        }else{
            args.push(str.slice(next,com))
            next = com + 1
        }

    }
    args.push(str.slice(next,rightPar))
    return args
}
function findTruth(ifFirstArg){
    let r = /IF\(/
    let match = r.exec(ifFirstArg)
    if(match !== null){
        throw new Error('Cannot have an IF statement as the first argument in an IF Statement')
    }
    let containsInvalidChars = /[^()+\-*/0-9.\s<>=!]/g.test(ifFirstArg)
    if(containsInvalidChars){
        let output = parseTruthStr(ifFirstArg, 'string')
        return output
    }else{
        let addedParens = parseTruthStr(ifFirstArg, 'number')
        let solver = new MathSolver()
        let output = solver.solveAndCompare(addedParens)
        return output
    }
}
function parseTruthStr(TFstr, compType){
    //check to ensure there is only one logical operator
    let operators = ['!=','<=','>=','=','<','>']
    let found = {}
    let str = TFstr.replace(/\s/g,"")
    //console.log(str)
    for (let i = 0; i < operators.length; i++) {
       const op = operators[i];
        let r
        if(op === '='){
            r = str.lastIndexOf('=')
            if(r !== -1){
                if(str[r-1] !== '<' && str[r-1] !== '>' && str[r-1] !=='!'){
                    found['='] = r
                }
            }
        }else if(op === '>'){
            r = str.lastIndexOf('>')
            if(r !== -1){
                if(str[r+1] !== '='){
                    found['>'] = r
                }
            }
        }else if(op === '<'){
            r = str.lastIndexOf('<')
            if(r !== -1){
                if(str[r+1] !== '='){
                    found['<'] = r
                }
            }
            }else{
                r = new RegExp(op,'g')
                let match = r.exec(TFstr)
                if(match){
                    found[op] = match.index
                }
            }
    }
    let tok = Object.keys(found)
    if(tok.length !== 1){
       throw new Error('Too many comparisons in comparison block: '+ TFstr)
    }
    if(compType === 'string'){
        let first = str.slice(0,found[tok[0]]-1)
        let second = str.slice(found[tok[0]]+ tok[0].length-1, str.length)
        console.log(first, second)
        if(tok[0] === "="){
            if(first == second){
                return true
            }else{
                return false
            }
        }else if(tok[0] === '!='){
            if(first !== second){
                return true
            }else{
                return false
            }
        }else{
            throw new Error('String Comparators can only be "=" or "!="; '+ tok[0] +' is not valid.')
        }
    }else{//number
        str = str.slice(0,found[tok[0]])+')'+tok[0]+'('+str.slice(found[tok[0]]+ tok[0].length, str.length)
        str = '(' + str
        str += ')'
    
    return str
   }

}
function stripDoubleQuotes(str){
    str = str.replace(/'/g,"")
    return str
}
//FUNCTION LINK PARSING
function initialParseLinks(fnString, rowID){
    let allLinkPattern = /\{([a-z0-9/.]+)\}/gi
    let out = {}
    let match
    while (match = allLinkPattern.exec(fnString)) {
        let replace = match[0]
        let path = match[1]
        let links = path.split('.')
        let linkMulti = isLinkMulti(links[0])
        let valueType = getColumnType(links[0])
        let summation = false
        console.log(linkMulti)
        if(linkMulti){
            let fnPattern =  regexVar("[A-Z]+(?=\\(~\\))", replace, 'g')//this will find the summation name ONLY for .linked link
            let wholeReplace = regexVar("[A-Z]+\\(~\\)", replace, 'g')//this will find the summation name ONLY for .linked link
            try{
                summation = fnPattern.exec(fnString)[0]
                replace = wholeReplace.exec(fnString)[0]
            }catch(e){
                throw new Error('Cannot find summation function on link multiple field:', links[0])
            }
        }
        out[path] = {replace,summation,links,linkMulti,value:false, currentRow: rowID, valueType}
    } 
    return out
}
function getCell(rowID,colStr){
    let [base,tval,pval] = colStr.split('/')
    let value = getValue([base,tval,pval,rowID], cache)
    if(value === undefined){
        loadRowPropToCache(rowID, pval)
        return undefined
    }
    return value
}

function getLinks(rowID, fnString, linksObj){
    if(linksObj === undefined){
        try{
            linksObj = initialParseLinks(fnString, rowID)
        }catch(e){
            throw new Error(e)
        }
    }
    let done = 0
    let links = Object.keys(linksObj)
    let dataMissing = false
    let outputStr
    for (const path in linksObj) {
        const pathInfo = linksObj[path];
        if(!pathInfo.done){//still has a link to find, gather all links that getCell returned false (means it sent request for data).
            if(!pathInfo.linkMulti && pathInfo.links.length === 1){//getCell should be a value
                pathInfo.data = getCell(pathInfo.currentRow, pathInfo.links[0])
                pathInfo.valueType = getColumnType(links[0])
            }else if(!pathInfo.linkMulti && pathInfo.links.length === 2){//getCell should be stringified link Obj
                let request = getCell(pathInfo.currentRow, pathInfo.links[0])
                if(request){
                    try{
                        request = JSON.parse(request)
                    }catch (e){
                        return console.log('Could not parse request:', request)
                    }
                    let links = 0
                    for (const link in request) {
                        const value = request[link];
                        if (value) {//is true
                            links ++
                        }
                    }
                    if(links === 1){//single link like it should be
                        console.log(pathInfo)
                        pathInfo.links.shift() //remove the successfully retrieved link
                        pathInfo.currentRow = Object.keys(request)[0]
                        pathInfo.data = getCell(pathInfo.currentRow,pathInfo.links[0])
                        pathInfo.valueType = getColumnType(pathInfo.links[0])
                    }
                }else{//getting data do nothing??
                    pathInfo.data = false
                }
            }else if(pathInfo.linkMulti && pathInfo.links.length === 2){//getCell should be stringified link Obj with one or more keys
                let request = getCell(pathInfo.currentRow, pathInfo.links[0])
                pathInfo.valueType = getColumnType(pathInfo.links[0])
                if(request){
                    try{
                        request = JSON.parse(request)
                    }catch (e){
                        return console.log('Could not parse request:', request)
                    }
                    pathInfo.data = []
                    for (const link in request) {
                        const value = request[link];
                        if (value) {//is true
                            pathInfo.links.shift() //remove the successfully retrieved link
                            pathInfo.currentRow = Object.keys(request)[0]
                            let linkData = getCell(pathInfo.currentRow,pathInfo.links[0])
                            pathInfo.data.push(linkData)
                        }
                    }
                }else{//getting data do nothing??
                    pathInfo.data = false
                }
            }else{
                
            }
        }else{
            done++
        }
        
    }
    if(done !== links.length){//we don't have all data
        for (const path in linksObj) {// go back through and see if we can do final value calcs
            const pathInfo = linksObj[path];
            if(!pathInfo.done){//still has a link it attempted to find, check value
                if(!pathInfo.linkMulti && pathInfo.links.length === 1){
                    if(pathInfo.data !== undefined){// data is present
                        if(typeof pathInfo.data === pathInfo.valueType){
                            pathInfo.value = pathInfo.data
                            pathInfo.done = true
                        }else{
                            try{
                                pathInfo.value = convertValueToType(pathInfo.data, pathInfo.valueType, pathInfo.links[0])
                            }catch (e){
                                return console.log(e)
                            }
                        }
                    }else{
                        dataMissing = true
                    }
                }else if(pathInfo.linkMulti && pathInfo.links.length === 1){//getCell should be stringified link Obj with one or more keys
                    let missing = 0
                    pathInfo.value = []
                    for (let i = 0; i < pathInfo.data.length; i++) {
                        const value = pathInfo.data[i];
                        if(value !== undefined){// data is present
                            if(typeof value === pathInfo.valueType){
                                pathInfo.value.push(value)
                                pathInfo.done = true
                            }else{
                                try{
                                    pathInfo.value.push(convertValueToType(pathInfo.data, pathInfo.valueType, pathInfo.links[0]))
                                }catch (e){
                                    return console.log(e)
                                }
                            }
                        }else{
                            missing++
                            dataMissing = true
                        }
                        
                    }
                    if(!missing){
                        pathInfo.done = true
                    }
                }else{
                   dataMissing = true
                }
            }
        }
    }
    if(dataMissing){
        console.log(linksObj)
        setTimeout(getLinks,500,rowID,fnString, linksObj)
        return false
    }
    for (const path in linksObj){
        let pathInfo = linksObj[path]
        let rep = pathInfo.replace
        let val = pathInfo.value
        let summer = pathInfo.summation
        if(summer && gfn[summer] !== undefined){
            val = gfn[summer](val)
        }
        let find = new RegExp(rep, 'g')
        fnString = fnString.replace(find,val)
    }
    return fnString
}
const gfn = {SUM,IF};




//LINK STUFF

function handleLinkColumn(path, configObj, backLinkCol){
    let [base, tval, pval] = path.split('/')
    let [linkBase, linkTval, linkPval] = (configObj.linksTo) ? configObj.linksTo.split('/') : [false,false,false]
    let [backLBase, backLTval, backLPval] = (backLinkCol) ? backLinkCol.split('/') : [false,false,false]
    
    let data = getValue([base,tval,pval], cache)
    if(!data){
        loadColDataToCache(base,tval,pval)
        setTimeout(handleLinkColumn, 100, path, configObj, backLinkCol)
        return
    }
    let targetLink = configObj.linksTo
    let targetTable = targetLink.t

    let colSoul = base + '/' + tval + '/r/' + pval
    let nextColSoul = (backLinkCol) ? backLBase + '/' + backLTval + '/r/' + backLPval : false
   
    let prevConfig = {path,colSoul}
    let nextConfig = {path: configObj.linksTo,nextLinkCol: backLinkCol, colSoul: nextColSoul}
    

    if(Object.keys(data).length === 0){
        handleNewLinkColumn(prevConfig, nextConfig)
        return console.log('No data to convert, config updated')
    }
    let putObj = {}
    let nextObj = {}
    let linkHIDs = getValue([linkBase, 'props',linkTval,'rows'], gb)
    for (const GBID in data) {//for values, create array from string
        const linkStr = String(data[GBID]);
        let linkGBID
        if(linkStr){
            putObj[GBID] = {}
            let linkArr = linkStr.split(', ')
            for (let i = 0; i < linkArr.length; i++) {//build new objects of GBids, prev and next links
                const HID = linkArr[i];
                linkGBID = findRowID(linkHIDs,HID)
                if(linkGBID){
                    if(!nextObj[linkGBID]){nextObj[linkGBID] = {}}
                    if(!putObj[GBID]){putObj[GBID] = {}}
                    putObj[GBID][linkGBID] = true
                    nextObj[linkGBID][GBID] = true
                }else{
                    if(!confirm('Cannot find: '+ HID + '  Continue linking?')){
                        return console.log('LINK ABORTED: Cannot find a match for: '+ HID + ' on table: ' + targetTable)
                    }
                    if(!putObj[GBID]){putObj[GBID] = {}}
                }
                
            }
            putObj[GBID] = JSON.stringify(putObj[GBID])
        }
    }
    for (const key in nextObj) {
        let value = nextObj[key];
        nextObj[key] = JSON.stringify(value)
    }
    console.log(putObj)
    console.log(nextObj)
    prevConfig.data = putObj
    nextConfig.data = nextObj
    handleNewLinkColumn(prevConfig, nextConfig)
}
function handleNewLinkColumn(prev, next){
    // let prevConfig = {path,colSoul, data: prevPutObj}
    // let nextConfig = {path: configObj.linksTo,nextLinkCol: backLinkCol, data: nextPutObj}
    if(next.colSoul){//all data
        gun.get(next.colSoul + '/config').put({GBtype: 'next', linksTo: prev.path})
        if (next.data !== undefined) {
            gun.get(next.colSoul).put(next.data)
        }
        gun.get(prev.colSoul + '/config').put({GBtype: 'prev', linksTo: next.nextLinkCol})
        if (prev.data !== undefined) {
            gun.get(prev.colSoul).put(prev.data)
        }
    }else{//create new next col on linksTo sheet
        let nextPathArgs = next.path.split('/')
        nextPathArgs.pop()
        let nextTPath = nextPathArgs.join('/')
        let call = {_path: nextTPath, newColumn}
        let nextP = call.newColumn(prev.t + "'s")
        let params = {GBtype: 'next', linksTo: prev.colSoul}
        if(next.data === undefined){
            next.data = false
        }
        if(nextP[0] !== 'p'){return console.log('did not return a new pval for new next col')}
        nextColSoul = nextPathArgs[0] + '/' + nextPathArgs[1] + '/r/' + nextP
        let nextPath = nextPathArgs[0] + '/' + nextPathArgs[1] + '/' + nextP
        gun.get(nextColSoul + '/config').put({GBtype: 'next', linksTo: prev.path})
        if (next.data !== undefined) {
            gun.get(nextColSoul).put(next.data)
        }
        gun.get(prev.colSoul + '/config').put({GBtype: 'prev', linksTo: nextPath})
        if (prev.data !== undefined) {
            gun.get(prev.colSoul).put(prev.data)
        }
    }
}

//IMPORT STUFF
function tsvJSONgb(tsv){
    let lines=tsv.split("\r\n");
    let result = [];
    let headers=lines[0].split("\t");
    for(let i=0;i<lines.length;i++){
      result[i] = []
        let currentline=lines[i].split("\t");
        for(let j=0;j<headers.length;j++){
        let value = currentline[j]
        let valType = value*1 || value.toString() //if it is number, make it a number, else string
        result[i][j] = valType;
        } 
    }
     
    return result; //JavaScript object
    //return JSON.stringify(result); //JSON
}
function handleImportColCreation(base, tval, colHeaders, datarow, append){
    // create configs
    let path = base+'/'+tval
    let gbpath = configPathFromChainPath(path)
    let colspath = gbpath.slice()
    colspath.push('props')
    let cols = getValue(colspath, gb)
    let results = {}
    let colExists = {}
    if(cols === undefined){//new table
        for (let i = 0; i < colHeaders.length; i++) {
            const palias = colHeaders[i];
            const colType = typeof datarow[i]
            const pval = 'p'+ i
            const sort = i*10
            results[palias] = pval
            let pconfig = newColumnConfig({alias: palias, GBtype: colType, sortval: sort})
            let typeCheck = checkConfig(newColumnConfig(), pconfig)
            if(typeCheck){
                gun.get(path + '/r/' + pval + '/config').put(pconfig)
                gun.get(path + '/r/p').put({[pval]: true})
            }
        }
    }else if(append){//existing table and we can add more columns/rows
        for (let j = 0; j < colHeaders.length; j++) {
            const col = colHeaders[j];
            let pval = findID(cols, col)
            if(pval !== undefined){
                colExists[col] = pval
            }else{
                colExists[col] = false
            }
        }
        let nextP = findNextID(path)
        let pInt = nextP.slice(1) *1
        let nextS = nextSortval(path)
        for (let i = 0; i < colHeaders.length; i++) {
            const palias = colHeaders[i];
            if(!colExists[palias]){
                let newP = 'p' + pInt
                const colType = typeof datarow[i]
                const pval = newP
                const sort = nextS
                results[palias] = pval
                let pconfig = newColumnConfig({alias: palias, GBtype: colType, sortval: sort})
                let typeCheck = checkConfig(newColumnConfig(), pconfig)
                if(typeCheck){
                    gun.get(path + '/r/' + pval + '/config').put(pconfig)
                    gun.get(path + '/r/p').put({[pval]: true})
                    pInt ++
                    nextS += 10
                }
            }else{
                results[palias] = colExists[palias]
            }
            
        }
    }
    
    return results
}
function handleTableImportPuts(path, resultObj){
    console.log(resultObj)
    //path base/tval
    let basesoul = path + '/r/'
    console.log(basesoul)
    gun.get(basesoul + 'p0').put(resultObj.p0)//put alias keys in first, to ensure they write first in case of disk error, can reimport
    //create instance nodes
    for (const rowID in resultObj.p0) {//put alias on row node
        const rowAlias = resultObj.p0[rowID]
        gun.get(rowID).get('p0').put(rowAlias)
    }
    //put column idx objs
    for (const key in resultObj) {//put rest of column data in
        if (key !== 'p0') {
            const putObj = resultObj[key];
            let gbsoul = basesoul + key
            gun.get(gbsoul).put(putObj)
        }
    }
}
function importData(tsv, ovrwrt, append){//UNTESTED
    //gbase[base].importNewTable(rawTSV, 'New Table Alias')
    if(ovrwrt !== undefined){//turn truthy falsy to boolean
        ovrwrt = (ovrwrt) ? true : false
    }else{
        ovrwrt = false
    }
    if(append !== undefined){
        append = (append) ? true : false
    }else{
        append = true
    }
    //append && ovrwrt: Add non-existing rows, and update existing rows
    //append && !ovrwrt: Add non-exiting rows, do not update existing rows <---Default
    //!append && ovrwrt: Do not add non-existing rows, update existing rows

    let dataArr = tsvJSONgb(tsv)
    let path = this._path // should be 'baseID/tval'
    let base = path.split('/')[0]
    let tval = path.split('/')[1]
    let result = {}
    let headers = dataArr[0]
    let headerPvals = handleImportColCreation(base, tval, headers, dataArr[1], append)
    let existingRows = getValue([base,'props',tval,'rows'], gb)

    for (let i = 1; i < dataArr.length; i++) {//start at 1, past header
        const rowArr = dataArr[i];
        let soul = findRowID(existingRows, rowArr[0])
        if(rowsoul === undefined){
            rowsoul =  base + '/' + tval + '/r' + Gun.text.random(6)
        }else{
            rowsoul = soul
        }
        if(rowArr[0] && ((append && ovrwrt)||(!append && ovrwrt && soul) || (!ovrwrt && append && !soul))){//only add if user said so
            for (let j = 0; j < rowArr.length; j++) {
                const value = rowArr[j];
                if(value !== ""){//ignore empty strings only
                    const header = headers[j]
                    const headerPval = headerPvals[header]
                    let GBidx = {}
                    GBidx[rowsoul] = value
                    result[headerPval] = Object.assign(result[headerPval], GBidx)
                }
            }
        }
    }
    handleTableImportPuts(path, result)
}
function importNewTable(tsv, tAlias,){
    //gbase[base].importNewTable(rawTSV, 'New Table Alias')
    let checkTname = checkUniqueAlias([path],tAlias)
    if(!checkTname){return console.log('ERROR: '+tAlias+' is not a unique table name')}
    let dataArr = tsvJSONgb(tsv)
    let path = this._path // should be 'baseID'
    let tval = findNextID(path)
    let nextSort = nextSortval(path)
    let tconfig = newTableConfig({alias: tAlias, sortval: nextSort})
    gun.get(path + '/' + tval + '/config').put(tconfig)
    let result = {}
    let headers = dataArr[0]
    let headerPvals = handleImportColCreation(path, tval, headers, dataArr[1], true)
    for (let i = 1; i < dataArr.length; i++) {//start at 1, past header
        const rowArr = dataArr[i];
        let rowsoul
        rowsoul =  path + '/' + tval + '/r' + Gun.text.random(6)
        if(rowArr[0]){//skip if HID is blank
            for (let j = 0; j < rowArr.length; j++) {
                const value = rowArr[j];
                if(value !== ""){//ignore empty strings only
                    const header = headers[j]
                    const headerPval = headerPvals[header]
                    if(typeof result[headerPval] !== 'object'){
                        result[headerPval] = {}
                    }
                    let GBidx = {}
                    GBidx[rowsoul] = value
                    result[headerPval] = Object.assign(result[headerPval], GBidx)
                }
            }
        }
    }
    gun.get(path + '/t').put({[tval]: true})
    let tpath = path + '/' + tval
    handleTableImportPuts(tpath, result)
    rebuildGBchain(tpath)
}

//CACHE
function loadColDataToCache(base, tval, pval){
    //gun.gbase(baseID).loadColDataToCache('t0','p0', this)
    let colSoul = base + '/' + tval + '/r/' + pval
    let path = [base, tval, pval]
    if(!getValue(path,cache)){//create subscription
        gun.get(colSoul, function(msg,eve){//check for existence only
            eve.off()
            gunSubs[colSoul] = true
            if(msg.put === undefined){
                setMergeValue(path, {},cache)
                if(pval === 'p0'){
                    mergeConfigState({},colSoul)
                    rebuildGBchain(colSoul)
                }
            }
        })
        gun.get(colSoul).on(function(gundata,id){
            gunSubs[colSoul] = true
            let data = Gun.obj.copy(gundata)
            delete data['_']
            setMergeValue(path,data,cache)
            handleNewData(colSoul, data)
            console.log('gun.on()',colSoul)
            if(pval === 'p0'){
                mergeConfigState(data,colSoul)
                rebuildGBchain(id)
            }
            for (const key in data) {
                let rowpath = [base, tval, 'rows', key]
                if (getValue(rowpath,cache) !== undefined) {
                    delete cache[base][tval].rows[key] 
                }
            }
            
        }, {change: true})
        //.off() row prop subs
        for (const on in gunSubs) {
            let call = on.split('+')
            let soul = call[0].split('/')
            if(call.length === 2 && soul[2] && soul[2] === pval){//had a sub prop call
                gun.get(call[0]).get(call[1]).off()
                gunSubs[on] = false
            }
        }
        
    }else{//do nothing, gun is already subscribed and cache is updating

    }
}
function loadRowPropToCache(path, pval){
    //path should be base/tval/rowid
    let pArgs = path.split('/')
    let base = pArgs[0]
    let tval = pArgs[1]
    let colSoul = base + '/' + tval + '/r/' + pval
    let cpath = [base, tval, pval, path]
    console.log(cpath)
    console.log(getValue(cpath,cache))
    if(!getValue(cpath,cache)){//create subscription
        gun.get(colSoul).get(path, function(msg,eve){//check for existence only
            eve.off()
            let subname = colSoul + '+' + path
            gunSubs[subname]
            if(msg.put === undefined){
                setMergeValue(cpath, "",cache)
            }
        })
        gun.get(colSoul).get(path).on(function(gundata,id){
            let subname = colSoul + '+' + path
            gunSubs[subname]
            let data = Gun.obj.copy(gundata)
            let dataObj = {[path]: data}
            handleNewData(colSoul, dataObj)
            setMergeValue(cpath,data,cache)
            let rowpath = [base, tval, 'rows', path]
            if (getValue(rowpath,cache) !== undefined) {
                delete cache[base][tval].rows[path] 
            }
            
        })
        
        
    }else{//do nothing, gun is already subscribed and cache is updating

    }
}
function getRow(path, colArr, inc){
    //path should be base/tval/rowid
    //colArr should be array of pvals requested
    console.log('getting row: '+ path)
    let pArgs = path.split('/')
    let cpath = cachePathFromChainPath(path)
    let fullObj = false
    let cacheValue = getValue(cpath,cache)
    let colsCached = 0
    let partialObj = {}
    if(!colArr){
        colArr = Object.keys(getValue([pArgs[0], 'props', pArgs[1], 'props'],gb))
        fullObj = true
    }
    console.log('getting row: '+ path + ' with properties:', colArr)
    for (let i = 0; i < colArr.length; i++) {//setup subs if needed
        const pval = colArr[i];
        let colPath = [pArgs[0],pArgs[1], pval, path]
        let data = getValue(colPath, cache)
        console.log(colPath, data)
        if(data === undefined){//add gun sub to cache
            loadRowPropToCache(path, pval)
        }else{
            colsCached ++
        }
    }
    if(colsCached !== colArr.length && inc <10){//recur and don't return, waiting for cache to load, 10 tries
        console.log(colsCached, colArr.length)
        inc++
        if(fullObj){
            setTimeout(getRow,50, path)
        }else{
            setTimeout(getRow,50, path, colArr)
        }
    }else if(colsCached === colArr.length){
        if(cacheValue !== undefined && fullObj){
            return cacheValue
        }else{
            for (let i = 0; i < colArr.length; i++) {
                const pval = colArr[i];
                let colPath = [pArgs[0],pArgs[1], pval, path]
                let data = getValue(colPath, cache)
                partialObj[pval] = data
            }
            return partialObj
        }
    }else{
        return console.log('ERROR: Could not retrieve data')
    }
}
function requestInitialData(path, colArr, reqType){
    //runs on initial subscription to send cached data to sub and set up gun calls, handleNewData will pass noncached data to sub
    //should match setupGsub mostly
    let pathArg = path.split('/')
    let base = pathArg[0]
    let tval = pathArg[1]
    let pval, rowid
    let cachedData = {}
    //generate configs from given args
    if(reqType === 'row'){//row path
        rowid = pathArg[2]
    }else if(reqType === 'column'){//column path
        pval = pathArg[2]
    }else{//table path
        rowid = false
        pval = false
    }
    if(!colArr && reqType === 'row' || reqType === 'table'){
        colArr = Object.keys(getValue([base, 'props', tval, 'props'],gb))
    }
    if(reqType === 'row'){
        console.log('getting row: '+ path + ' with properties:', colArr)
        cachedData[rowid] = {}
        for (let i = 0; i < colArr.length; i++) {//setup subs if needed
            const pval = colArr[i];
            let colPath = [base,tval, pval, path]
            let data = getValue(colPath, cache)
            //console.log(colPath, data)
            if(data === undefined){//add gun sub to cache
                loadRowPropToCache(path, pval)
            }else{
                cachedData[rowid][pval] = data
            }
        }

    }else if(reqType === 'table'){
        console.log('getting table: '+ path + ' with properties:', colArr)
        let tRows = getValue([base, 'props', tval, 'rows'], gb)
        for (let i = 0; i < colArr.length; i++) {//could have some row subs, but not col sub, sub columns if not already
            const pval = colArr[i];
            let colSoul = base + '/' + tval +'/r/' + pval
            if(!gunSubs[colSoul]){
                loadColDataToCache(base,tval,pval)
            }
        }
        for (const row in tRows) {
            cachedData[row] = {}
            for (let i = 0; i < colArr.length; i++) {//setup subs if needed
                const pval = colArr[i];
                let rowPath = [base,tval, pval, row]
                let data = getValue(rowPath, cache)
                if(data !== undefined){//add gun sub to cache
                    cachedData[row][pval] = data
                }else{
                    //rest will come though in gun.on()>handleNewData()>user CB
                }
            }
        }
    }else if(reqType === 'column'){
        console.log('getting column: '+ path)
        let colSoul = base + '/' + tval +'/r/' + pval
        if(!gunSubs[colSoul]){
            loadColDataToCache(base,tval,pval)
        }
        let colPath = [base,tval, pval]
        let data = getValue(colPath, cache)
        if(data !== undefined){
            cachedData = data
        }
    }
    return cachedData
}


//EVENT HANDLING AND BUFFER
function watchObj(){
}
Object.defineProperty(watchObj.prototype, "watch", {
    enumerable: false
  , configurable: true
  , writable: false
  , value: function (prop, handler) {
      var
        oldval = this[prop]
      , getter = function () {
          return oldval;
      }
      , setter = function (newval) {
          if (oldval !== newval) {
              handler.call(this, newval, prop);
              oldval = newval;
          }
          else { return false }
      }
      ;
      
      if (delete this[prop]) { // can't watch constants
          Object.defineProperty(this, prop, {
                get: getter
              , set: setter
              , enumerable: true
              , configurable: true
          });
      }
  }
});

//sub id format: 
//row: tval/rowid/pval1,pval2,pvaln-subID <--subID is random AN string
//table: tval/pval1,pval2,pvaln-subID <--subID is random AN string
//column: tval/r/pval-subID <--subID is random AN string

//basically any data edit on a column soul will update any sub
function flushSubBuffer(){
    let buffer = Gun.obj.copy(subBuffer)
    subBuffer = {}
    console.log('flushing buffer', buffer)
    bufferState = false
    for (const base in gsubs) {
        const subs = gsubs[base];
        for (const subID in subs) {
            handleSubUpdate(subID, buffer)
        }
    }
}
function parseSubID(subID){
    let subType
    let baseArgs = subID.split('/')
    let base = baseArgs[0]
    let tval = baseArgs[1]
    let rowid
    if(baseArgs[2][0] === 'r' && baseArgs[2].length > 1){
        subType = 'row'
        rowid = base + '/' + tval + '/' + baseArgs[2]
    }else if(baseArgs[2][0] === 'p' || baseArgs[2][0] === 'A'){
        subType = 'table'
    }else{
        subType = 'column'
    }
    let pvalstr = baseArgs.pop()//last '/' should be ',' pvals and '-' id
    let pvalandid = pvalstr.split('-')
    let pvals = pvalandid[0].split(',')
    let id = pvalandid[1]
    return [subType,base,tval,pvals,rowid]
}
function handleSubUpdate(subID, buffer){
    let out = {}
    let [type, base, tval, pvals, rowid] = parseSubID(subID)
    console.log(subID, type)
    if(type === 'row'){
        let row = getValue([base,tval,rowid], buffer)
        if(row !== undefined && pvals[0] !== 'ALL'){
            if(pvals[0] !== 'ALL'){
                let rowCopy = Gun.obj.copy(row)
                for (const pval in rowCopy) {
                    let includes = pvals.includes(pval)
                    if(!includes){
                        delete rowCopy[pval]
                    }
                }
                out = rowCopy
            }else{
                out = row
            }
            
        }
    }else if(type === 'table'){
        let table = getValue([base,tval], buffer)
        console.log(table)
        if(table !== undefined){
            console.log(pvals[0])
            if(pvals[0] !== 'ALL'){
                for (const rowid in table) {
                    const row = table[rowid];
                    let rowCopy = Gun.obj.copy(row) || {}
                    for (const pval in rowCopy) {
                        let includes = pvals.includes(pval)
                        if(!includes){
                            delete rowCopy[pval]
                        }
                    }
                    out = Object.assign(out,rowCopy)
                    console.log(out)
                }
            }else{
                out = table
                console.log('all',out)
            }
            
        }
    }else{//column
        let table = getValue([base,tval], buffer)
        let pval = pvals[0]//should only be one
        if(table !== undefined){
            for (const rowid in table) {
                const row = table[rowid];
                if(row[pval] !== undefined){
                    let colObj = {[rowid]: row[pval]}
                    out = object.assign(out,colObj)
                }
            }
        }
    }
    if(Object.keys(out).length > 0){
        gsubs[base][subID] = out //should fire user CB from .watch
    }
}
function handleNewData(soul, data){
    //parse gun soul and keys in data
    //console.log('handle new Data' ,soul)
    let pathArgs = soul.split('/')
    let base = pathArgs[0]
    let tval = pathArgs[1]
    let pval = pathArgs[3]
    for (const rowid in data) {
        const value = data[rowid];
        setValue([base,tval,rowid,pval], value, subBuffer)
    }
    if(!bufferState){
        bufferState = true
        setTimeout(flushSubBuffer, 100)
    }
    // determine what has changed
    //set new values
}




//REACT STUFF
function loadGBaseConfig(thisReact){
    reactConfigCB = thisReact

}
function tableToState(base, tval, thisReact){
    let oldData = getValue([base,tval,'last'], vTable)
    let flaggedCols = linkColIdxs(base,tval)
    if(thisReact.state && thisReact.state.vTable && oldData !== undefined && JSON.stringify(oldData) !== JSON.stringify(thisReact.state.vTable)){
        thisReact.setState({vTable: oldData, linkColumns: flaggedCols})
        return
    }


    let _path = base + '/' + tval
    let subID = base + '+' + tval
    let call = {_path, subscribe}
    call.subscribe(function(data){
        let flaggedCols = linkColIdxs(base,tval)
        let links = linkColPvals(base,tval)
        let rows = getValue([base, 'props', tval, 'rows'], gb)     
        if(!rows){return}
        let [headers, headerValues] = generateHeaderRow(base, tval)
        let newTable = [headerValues]
        for (const rowid in data) {// put data in
            const rowObj = data[rowid];
            setMergeValue([base,tval,rowid],rowObj,vTable)
        }
        //build new output array, first, could sort rows
        let tableData = getValue([base,tval], vTable)
        let sortedRows = Object.values(rows)
        let rowsbyalias = {}
        if(String(typeof sortedRows[0] * 1) === 'NaN'){
            sortedRows.sort()
        }else{
            sortedRows.sort(function(a, b){return a - b});
        }
        for (const rowID in rows) {
            const rowAlias = rows[rowID]
            rowsbyalias[rowAlias] = rowID
        }
        for (let i = 0; i < sortedRows.length; i++) {
            const rowAlias = sortedRows[i];
            const rowID = rowsbyalias[rowAlias]
            const rowObj = tableData[rowID]
            let rowArr = xformRowObjToArr(rowObj, headers, links)
            newTable.push(rowArr)
        }
        if(thisReact.state && JSON.stringify(getValue([base,tval,'last'],vTable)) !== JSON.stringify(newTable) || !self.state.linkColumns || JSON.stringify(self.state.linkColumns) !== JSON.stringify(flaggedCols)){
            setValue([base, tval, 'last'], newTable, vTable)
            thisReact.setState({vTable: newTable,linkColumns: flaggedCols})
        }
        
    }, undefined, true, true, subID)
}
function rowToState(rowID, thisReact){
    let [base, tval, rval] = rowID.split('/')
    let oldData = getValue([base,tval,rowID], vTable)
    if(oldData !== undefined){
        let links = linkColPvals(base,tval)
        let [headers, headerValues] = generateHeaderRow(base, tval)
        let oldRow = [headerValues]
        let rowArr = xformRowObjToArr(oldData, headers,links)
        oldRow.push(rowArr)
        if(thisReact.state && thisReact.state.rowObj && oldData !== undefined && JSON.stringify(oldData) !== JSON.stringify(thisReact.state.rowObj)){
            thisReact.setState({vRow: newRow})
            for (const pval in oldData) {
                const value = oldData[pval];
                thisReact.setState({[pval]: value})
            }
            return
        }

    }
    let _path = rowID
    let subID = base + '+' + tval + '+' + rval
    let call = {_path, subscribe}
    call.subscribe(function(data){
        let links = linkColPvals(base,tval)
        let [headers, headerValues] = generateHeaderRow(base, tval)
        let newRow = [headerValues]
        let rowObj
        for (const rowid in data) {// put data in
            rowObj = data[rowid];
            setMergeValue([base,tval,rowid],rowObj,vTable)
        }
        let rowArr = xformRowObjToArr(rowObj, headers, links)
        newRow.push(rowArr)
        let rowValue = getValue([base,tval,rowID], vTable)
        if(!thisReact.state.vRow || thisReact.state.vRow && rowValue && JSON.stringify(rowValue) !== JSON.stringify(thisReact.state.vRow)){
            thisReact.setState({vRow: newRow})
            for (const pval in rowValue) {
                if(links[pval]){//value is link
                    let cellValue = []
                    let linksObj
                    try{
                        linksObj = JSON.parse(rowObj[pval])
                    }catch (err){
                        rowArr.push(rowObj[pval])
                    }
                    for (const linkRowID in linksObj) {
                        const value = linksObj[linkRowID];
                        if (value) {
                            cellValue.push(findRowAlias(linkRowID))
                        }
                    }
                    thisReact.setState({[pval]: cellValue})
    
                }else{
                    const value = rowValue[pval];
                    thisReact.setState({[pval]: value})
                }
                
            }
        }
        
    }, undefined, true, true, subID)
}
function buildRoutes(thisReact, baseID){
    let result = []
    let byAlias = gbByAlias(gb)
    let forUI = gbForUI(gb)
    if(byAlias === undefined || forUI[baseID] === undefined){return}
    let tables = Object.values(forUI[baseID])
    for (let i = 0; i < tables.length; i++) {
        let tableObj = {}
        const table = tables[i];
        let tval = Object.keys(table)[0]
        tableObj.alias = gb[baseID].props[tval].alias
        tableObj.base = baseID
        tableObj.key = tval
        tableObj.cols = []
        tableObj.colalias = {}
        tableObj.rowHID = []
        if(gb[baseID].props[tval].rows){
            for (const HID in byAlias[baseID].props[tableObj.alias].rows) {
                const GBID = byAlias[baseID].props[tableObj.alias].rows[HID];
                if (GBID) {
                    tableObj.rowHID.push({[HID]: GBID})
                }
            }
        }
        result.push(tableObj)
        let columns = Object.values(table[tval])
        for (let j = 0; j < columns.length; j++) {
            const pval = columns[j];
            let palias = gb[baseID].props[tval].props[pval].alias
            tableObj.colalias[pval] = palias
            result[i].cols.push(pval)
        }
    }
    if(!thisReact.state.GBroutes || JSON.stringify(thisReact.state.GBroutes) !== JSON.stringify(result)){
        thisReact.setState({GBroutes: result})
    }
}
function generateHeaderRow(base, tval){
    let columns = getValue([base, 'props', tval, 'props'], gb)
    let headerAlias = {}
    let headerOrder = {}
    let headers = []
    let headerValues = []
    for (const pval in columns) {
        const alias = columns[pval].alias;
        const sortval = columns[pval].sortval;
        headerAlias[pval] = alias
        headerOrder[sortval] = pval
    }
    let headerSort = Object.keys(headerOrder).sort(function(a, b){return a - b});
    for (let i = 0; i < headerSort.length; i++) {
        const sortVal = headerSort[i];
        headers.push(headerOrder[sortVal])
        headerValues.push(headerAlias[headerOrder[sortVal]])
    }
    return [headers,headerValues]

}
function xformRowObjToArr(rowObj, orderedHeader, linkColPvals){
    let rowArr = []
    for (let j = 0; j < orderedHeader.length; j++) {
        const pval = orderedHeader[j];
        let linksObj
        if(rowObj[pval]){
            if(linkColPvals[pval]){//value is link
                let cellValue = []
                try{
                    linksObj = JSON.parse(rowObj[pval])
                }catch (err){
                    rowArr.push(rowObj[pval])
                }
                for (const linkRowID in linksObj) {
                    const value = linksObj[linkRowID];
                    if (value) {
                        cellValue.push(findRowAlias(linkRowID))
                    }
                }
                rowArr.push(cellValue)

            }else{//value is data
                rowArr.push(rowObj[pval])
            }
        }else{
            rowArr.push('')
        }
    }
    return rowArr
}
function linkColIdxs(base, tval){
    let headers = generateHeaderRow(base,tval)[0]
    let links = linkColPvals(base,tval)
    console.log(links)
    let flaggedCols = []
    for (let i = 0; i < headers.length; i++) {
        const pval = headers[i];
        console.log(pval)
        if(links[pval]){
            flaggedCols.push(i)
        }
    }
    return flaggedCols
}



//GBase FN wrappers
function SUM(args){
    let result = 0;
    for (let i = 0; i < args.length; i++) {
        let value = parseInt(args[i]);
        if(isNaN(value)){
            throw new Error('Value is not a number: '+ args[i])
        }
        result += value
    }
    return result;
}
function IF(args){
    let clean = evaluateAllFN(args[0])
    let torf = findTruth(clean)
    if(torf){
        let out = evaluateAllFN(args[1])
        return out
    }else{
        let out = evaluateAllFN(args[2])
        return out
    }
}

//WIP___________________________________________________















//OLD WRANGLER STUFF
async function cascade(method, curNode, doSettle){
    let currentNode = Gun.obj.copy(curNode)
    if(doSettle == undefined){
        doSettle = true
    }
    let gun = this.back(-1)
    console.log('cascading: ', method)
    let type = currentNode['!TYPE']
    let nodeSoul = type + '/' + currentNode['!ID']
    let next = Object.keys(GB[type].next)[0]
    let nextSet = currentNode[next]['#']
    let prevsForCalc = GB[type].methods[method].fields
    let prevs = Object.keys(prevsForCalc)
    let methodFn = GB[type].methods[method].fn
    let prevNodes = []

    for (let i = 0; i < prevs.length; i++) {
        const prop = prevs[i];
        let cur = prevNodes[i];
        const prevProp = prevsForCalc[prevs[i]]
        if(currentNode[prop] && typeof currentNode[prop] === 'object'){
            cur = await gunGetListNodes(gun,currentNode[prop]['#'])
        }else{
            cur = currentNode[prop]
        }
        if(Array.isArray(cur)){
            let curRed = cur.reduce(function(acc,node,idx){
                let num = (Number(node[prevProp])) ? Number(node[prevProp]) : 0
                acc += num
                return acc
            }, 0)
            currentNode[prop] = curRed
        }else{
            currentNode[prop] = cur
        }
    }
    console.log(currentNode)
    let fnres = methodFn(currentNode)
    if(!doSettle){
        let mutate = Object.assign({}, currentNode, fnres)
        return mutate
    }else{
        gun.get(nodeSoul).settle(fnres,{cascade:false})
        let nextNodes
        if(currentNode[next] && typeof currentNode[next] === 'object'){
            nextNodes = await gunGetListNodes(gun,nextSet)
            if(Array.isArray(nextNodes)){
                for (let i = 0; i < nextNodes.length; i++) {
                    const node = Gun.obj.copy(nextNodes[i])
                    let nextType = node['!TYPE']
                    let nextID = node['!ID']
                    let nextSoul = nextType +'/'+nextID
                    let cascadeProp = (GB[nextType].cascade) ? getKeyByValue(GB[nextType].cascade,method) : false
                    console.log('Number of next cascades:', nextNodes.length)
                    let putObj = {}
                    putObj[cascadeProp] = 0
                    let opt = {prevData: node}
                    gun.get(nextSoul).settle(putObj,opt)
                }
            }
        }
    }
}

function archive(){
    let gun = this;
    let gunRoot = this.back(-1)
    let result = {}
    let type
    let nodeSoul = gun['_']['soul'] || false
    if(!nodeSoul){
        return console.log('Must select a node with known nodeType. ie; .get("nodeType/00someID00").archive()')}
    gun.on(function(archiveNode){
        type = archiveNode['!TYPE']
        let forceDelete = archiveNode['!DELETED'] || false
        let props = GB[type].whereTag
        for (let i = 0; i < props.length; i++){
            result[props[i]] = {add: [],remove: []}
            gun.get(props[i]).once(function(tags){
                for (const key in tags) {
                    if(forceDelete && tags[key] !== '_' && tags[key] !== '!ARCHIVED'){
                        result[props[i]].remove.push(key) //null all tags even if they are '0'
                    }else if(tags[key] == 1){
                        gun.get(props[i]).get('!ARCHIVED').get(key).put(1)
                        result[props[i]].remove.push(key)
                    }
                }
            })
        }
        gun.get('!DELETED').put(true)
        gunRoot.get('!TYPE/'+type).get(nodeSoul).put(null)
        gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(nodeSoul).put({'#': nodeSoul})
        console.log(result)

    })
    console.log(result)
    handleTags(gun,result,type)
}
function unarchive(){
    let gun = this;
    let gunRoot = this.back(-1)
    let type
    let result = {}
    let nodeSoul = gun['_']['soul'] || false
    if(!nodeSoul){
        return console.log('Must select a node with known nodeType. ie; .get("nodeType/00someID00").archive()')}
    gun.on(function(archiveNode){
        type = archiveNode['!TYPE']
        let props = GB[type].whereTag
        for (let i = 0; i < props.length; i++){
            result[props[i]] = {add: [],remove: []}
            gun.get(props[i]).get('!ARCHIVED').once(function(tags){
                for (const key in tags) {
                    if(tags[key] == 1){
                        
                        result[props[i]].add.push(key)
                    }
                }
            })
            gun.get(props[i]).get('!ARCHIVED').put(null)
        }
        gun.get('!DELETED').put(false)
        gunRoot.get('!TYPE/'+type).get(nodeSoul).put({'#': nodeSoul})
        gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(nodeSoul).put(null)

    })
    console.log(result)
    handleTags(gun,result,type)
}
function deleteNode(){
    let gun = this;
    let gunRoot = this.back(-1)
    let fromNodeSoul = gun['_']['soul'] || false
    if(!fromNodeSoul){
        return console.log('Must select a node with known nodeType. ie; gun.get("nodeType/654someID123").delete()')}
    let check = new Promise( (resolve, reject) => {
        let exist = gun.then()
        resolve(exist)
    })
    check.then( (data) => {
        let fromType = data['!TYPE']
        let nextKey = Object.keys(GB[fromType]['next'])[0] //should only ever be a sinlge next key
        let prevKeys = Object.keys(GB[fromType]['prev'])
        gun.get(nextKey).on( (ids) => {
                for (const key in ids) {
                    if(ids[key] !== null){
                        gun.get(key).unlink(gunRoot.get(fromNodeSoul))
                    }
                }
            })
        for (let i = 0; i < prevKeys.length; i++) {
            const prop = prevKeys[i];
            gun.get(prop).on(function(ids){
                for (const key in ids) {
                    if(ids[key] !== null){
                        gun.get(fromNodeSoul).unlink(gunRoot.get(key))
                    }
                }
            })
        }



        // gun.once(function(archiveNode){//null out fields
        //     let type = archiveNode['!TYPE']
        //     gunRoot.get('!TYPE/'+type+'/ARCHIVED').get(fromNodeSoul).put(null)
        //     gunRoot.get('!TYPE/'+type+'/DELETED').get(fromNodeSoul).put({'#': fromNodeSoul})
        //     for (const key in archiveNode) {
        //         if(key !== '_' || key !== '!DELETED'){//otherwise we break things
        //             gun.get(key).put(null)
        //         }
        //     }
            
        // })
    })
}


async function assembleTree(gun, node, fromID, archived, max, inc, arr){
    let res
    let idRef
    let newNode
    if(inc === undefined){//initial call
        newNode = Gun.obj.copy(node)
        inc = 0
        max = max || Infinity
        arr = [[],[]];
        let arrObj = {id: fromID,
                    data: newNode,
                    from: false,
                    prop: false
                    }   
        arr[0][0] = arrObj
        res = [node, arr]
        fromID = fromID
        
    }
    if(inc == max){return}
    //console.log(inc)
    inc++
    let refsToTraverse = Object.keys(GB[node['!TYPE']]['prev'])
    if (refsToTraverse){
        for (let i = 0; i < refsToTraverse.length; i++){
            if (node[refsToTraverse[i]]){
                if(!Array.isArray(arr[inc])){arr[inc] = []}
                let lookup = node[refsToTraverse[i]]["#"]
                let id = {id: lookup} //arr
                idRef = Object.assign({}, id) //arr
                let subthings = []
                //console.log(lookup)
                let propRef = await gunGetListNodes(gun, lookup)
                propRef.map(function(node){
                    let subNode = Gun.obj.copy(node)

                    if(!archived && subNode['!DELETED']){
                        
                    }else{
                        subthings.push(subNode)
                        let newObj = Object.assign({}, subNode)
                        let nodeInfo = {data: newObj,
                                        from: fromID,
                                        prop: refsToTraverse[i]}
                        let arrObj = Object.assign({}, idRef, nodeInfo)
                        arr[inc].push(arrObj)
                    }
                })
            node[refsToTraverse[i]] = Gun.obj.copy(subthings)
            }
        }
        //console.log(node)
        //console.log(arr)
        for (let i = 0; i < refsToTraverse.length; i++){
            if (node[refsToTraverse[i]]){
                for (let j = 0; j < node[refsToTraverse[i]].length; j++){
                let nextLevel = node[refsToTraverse[i]][j]
                assembleTree(gun, nextLevel, idRef.id, archived, max, inc, arr);//fires for each prop with refs, and once for each ref on said prop
                }
            }
        }
    }
    //accumulate math?
    return res; // Should return the full tree
}

function reduceRight(treeArr, method , acc){
    acc = acc || false //accumulate all mapper returns to single value, if false, will tree reduce
    let reduced = 0
    let calcArr = JSON.parse(JSON.stringify(treeArr))//?
    treeArr.push(calcArr)
    for (let i = calcArr.length-1; i > -1; i--){
        for (let j = 0; j < calcArr[i].length; j++){
            let node = (calcArr[i][j].data) ? calcArr[i][j].data : calcArr[i][j]//?
            let fromID = calcArr[i][j].from
            let fromProp = calcArr[i][j].prop
            if(node && !node['!DELETED']){
                let mapper = GB[node['!TYPE']]["methods"][method]
                let res = mapper(node)
                reduced += res
                console.log(calcArr[i][j])
                calcArr[i][j].data = res//?
                //let parent = _.find(calcArr[i-1], ['id', fromID])
                let parent = (calcArr[i-1]) ? calcArr[i-1].find(function(i){
                    return i.id == fromID
                }) : undefined
                if(!parent){
                    console.log(reduced)
                    treeArr = res
                }else{
                    if(typeof parent.data[fromProp] !== 'number'){//if it is a ref, replace with first value
                    parent.data[fromProp] = res
                    }else{
                        parent.data[fromProp] += res //if not a ref, then take old value and add it to new value
                        console.log(calcArr)
                    }
                }
            }
        }
    }
    let ret = (acc) ? reduced : treeArr
    return ret
}
function generateTreeObj(startNodeID, opt){
    let gun = this.back(-1)
    let archived = (opt) ? opt.archived || false : false
    let max = (opt) ? opt.max || undefined : undefined
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
    let tree = gunGet(gun,startNodeID).then(parentNode =>{
        let copy = Gun.obj.copy(parentNode) 
        return assembleTree(gun, copy, startNodeID, archived, max)})
    return tree
}
function generateTreeArr(startNodeID, max, archived){
    let gun = this.back(-1)
    archived = archived || false
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, archived, max)//?
    return tree[1]
}
function treeReduceRight(startNodeID, method, acc, max){
    let gun = this.back(-1)
    if (startNodeID['_']['$']){startNodeID = startNodeID['_']['soul']}
	let parentNode
	gun.get(startNodeID).on(e => parentNode = Gun.obj.copy(e))
    let tree = assembleTree(gun, parentNode, startNodeID, false, max)//?
    let methodCalc = reduceRight(tree[1], method, acc)
    return methodCalc
}

//Tree Logic



module.exports = {
    buildRoutes,
    getRow,
    tableToState,
    rowToState,
    loadGBaseConfig,
    gbase,
    gb
}