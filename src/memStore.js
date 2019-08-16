import { snapID, isLink,isSub, getValue } from "./util";

export default function MemStore(root){
    let self = this
    this.mem = new Map()
    this.addrSubs = {}
    this.nodeSubs = {}
    this.addPropToNode = function(id,prop){
        let thing = self.mem.get(id) || self.mem.set(id,{full:false,props:new Set()}).get(id)
        thing.props.add(prop)
    }
    this.addFullNode = function(id){
        let thing = self.mem.get(id) || self.mem.set(id,{full:true,props:new Set()}).get(id)
        thing.full = true
    }
    this.get = function(nodeID,pval){//returns exactly the thing at the asked location
        let ido = snapID(nodeID)
        if(!pval){
            let ps = self.mem.get(nodeID)
            if(ps && ps.full){//only nodes with full flag can be gotten without network
                let out = {}
                for (const p of ps) {
                    out[p] = self.mem.get(ido.toAddress(p))
                }
                return out
            }
            return
        }
        return self.mem.get(ido.toAddress(pval))
    }
    this.getAddrValue = function(nodeID,pval){//returns the substituted value
        let address = snapID(nodeID).toAddress(pval)
        let v = self.mem.get(address)//if it is inherited we want the value to go out to buffer
        let from = address
        let lookup 
        while ((lookup = isSub((v && v.v)))) {
            from = lookup.toStr()
            v = self.mem.get(from)
            v = v && v.v
        }
        return [v,from]
    }
    this.put = function(nodeID,obj){

    }
    this.subProp = function(id,p,cb,subID){

    }
    this.subNode = function(id,cb,subID){

    }
    this.resolvedAsk = function(things){
        //these are not currently in mem
        //just need to add them to store, fire cb's, and (opt) send to persist
        for (const id in things) {
            const obj = things[id];
            self.mem[id] = self.mem[id] || new Set()
            let temp
            if((temp = root.router.getNodeDoneCBs[id])){
                // we requested a full node
                // so we can put the 'full' flag in mem
                self.addFullNode(id)
                for (const [cb,raw] of temp) {
                    if(!raw)//apply formatting
                    cb(self.extractVals(obj))
                }
            }
            let ido = snapID(id)
            for (const prop in obj) {
                self.addPropToNode(id,prop)
                self.mem[id].add(prop)
                const vase = obj[prop];
                let addr = ido.toAddress(prop)
                self.sendToCache(id,prop,vase)
                let argsArr = root.router.getCellDoneCBs[addr]
                if(!argsArr) continue
                for (const args of argsArr) {
                    let s = isSub(vase.v)
                    if(s && !args[2]){//args[2] = truthy flag for exact value at this address, not the inherited/linked value
                        // if(!p){//link to another node... that represents this value???No, just like substitute effectively
                        //     root.getNode(s,function(node){
                        //         self.returnGetValue(s,false,node,...args)
                        //     },true)
                        // }else{//direct substitue
                            root.getCell(s.toNodeID(),s.p,...args)
                        // }
                    }else{
                        self.returnGetValue(id,prop,vase.v,...args)
                    }
                }
            } 
        }
    }
    this.extractVals = function(node){
        let copy = {}
        for (const p in node) {
            const vase = node[p];
            copy[p] = vase.v
        }
        return copy
    }
    this.sendToCache = function(nodeID, p, vase){
        let newEnq = handleCacheDep(nodeID,p,vase.v)//will get deps correct so we can return proper data to buffer
        let address = toAddress(nodeID,p)
        let [v,from] = self.getAddrValue(nodeID,p)
        if(newEnq || (from === address && vase.v !== v)){//this is some sort of new/changed value
            self.mem.set(address,vase)
            handlePropDataChange()
        }
        function handlePropDataChange(){
            let startAddress = (address === from) ? from : address
            checkDeps(startAddress)
            function checkDeps(changedAddress){
                let deps = upDeps[changedAddress]
                if(deps){
                    for (const depAddr of deps) {
                        let subs = addrSubs[depAddr]
                        if(subs === undefined)continue
                        let [nodeID,pval]= removeP(depAddr)
                        root.getCell(nodeID,pval,processValue(depAddr,subs),true,false)
                        checkDeps(depAddr)//recur... until it can't
                    }
                }
            }
            
        }
    }
    this.upDeps = {}
    this.downDeps = {}
    this.handleCacheDep = function(nodeID, pval, val){
        let ido = snapID(nodeID)
        const address = ido.toAddress(pval)
        let [s,p] = isLookup(val)
        if(!s){//could have changed from Enq to val
            return removeDep()
        }
        let downDeps = self.downDeps
        let upDeps = self.upDeps
        let inheritsNodeID = snapID(s).toAddress(p)
        const looksAtAddress = inheritsNodeID
        if(!downDeps[address]){//add
            addDep()
            return true
        }
        if(downDeps[address] && downDeps[address] !== inheritsNodeID){//change if different
            removeDep()
            addDep()
            return true
        }
        return false
        function addDep(){
            downDeps[address] = looksAtAddress
            if(!upDeps[looksAtAddress])upDeps[looksAtAddress] = new Set()
            upDeps[looksAtAddress].add(address)
        }
        function removeDep(){
            let oldDep = downDeps[address]
            if(oldDep && upDeps[oldDep])upDeps[oldDep].delete(address)
            if(oldDep) delete downDeps[address]
    
            if(upDeps[address])return true
            return false
    
        }
    }







    function dumpStateChanges(){//will have to check 'says' for
        let buffer = Object.assign({}, nodeStatesBuffer)
        nodeStatesBuffer = {}
        stateBuffer = !stateBuffer
        sendToSubs(buffer)
    }

    function sendToSubs(buffer){//only for states, to make sure queries include new items
        for (const baseid in querySubs) {
            if(!buffer[baseid])continue
            const subO = querySubs[baseid];
            for (const sVal in subO) {
                const qParams = subO[sVal];
                qParams.newStates(buffer[baseid])   
            }
        }
        
    }
    
    function formatData(format, pType,dType,val){
        //returns the formatted value
        if(format){
            if(pType === 'date'){
                //date formatting
                //format should be an object
            }else{
                //solve()? need a subsitute
                //might make a formatter solve so it is faster
            }
        }
        return val
    }
    
    
    function processValue(addr,subs){
        return function(val,from){
            let {format,propType,dataType} = getValue(configPathFromChainPath(addr),gb)
            if(dataType === 'array'){
                try{
                    val = JSON.parse(val)
                }catch(e){} 
            }
            for (const sID in subs) { //value has changed, trigger all subs
                handleSub(subs[sID],val)
            }
            const syms = Object.getOwnPropertySymbols(subs)
            for (const sym of syms) {
                handleSub(subs[sym],val)
            }
            function handleSub(subO,val){
                //console.log('firing sub for',addr)
                const {cb,raw} = subO
                if(!raw){
                    val = formatData(format,propType,dataType,val)
                }
                //console.log('firing sub with value:',val)
                cb.call(cb,val,from)
            }
        }
    }
    this.returnGetValue = function(fromID,fromP,val,cb,raw){
        let ido = snapID(fromID)
        let {b,t,r,p} = ido
        if(!fromP && !p){//weird link, but technically valid, val is a full node
            cb.call(cb,val, fromID,fromP)
            return
        }
        fromP = fromP || p
        let {propType,dataType,format} = getValue(configPathFromChainPath(makeSoul({b,t,r,p:fromP})),gb)//UPDATE
        if([null,undefined].includes(val)){
            cb.call(cb,null,fromID,fromP)
            //console.log('getCell,NULL in:',Date.now()-start)
            return
        }
        //so we have data on this soul and this should be returned to the cb
        if(dataType === 'unorderedSet'){//this will be a full object
            let data = JSON.parse(JSON.stringify(val))
            let setVals = []
            if(Array.isArray(data)){
                setVals = data.slice()
            }else{
                for (const key in data) {
                    if(key === '_')continue
                    const boolean = data[key];
                    if (boolean) {//if currently part of the set
                        setVals.push(key) 
                    }
                }
            }
            
            if(fromP === 'LABELS')setVals.unshift(t)
            val = setVals
        }else if(dataType === 'array'){
            try {
                val = JSON.parse(val)
                for (let i = 0; i < val.length; i++) {
                    const el = val[i];
                    if(ISO_DATE_PATTERN.test(el)){//JSON takes a date object to ISO string on conversion
                        val[i] = new Date(el)
                    }
                }
            } catch (error) {
                // leave as is..
            }
        }
        if(!raw)val = formatData(format,propType,dataType,val)
        cb.call(cb,val, fromID,fromP)
        //console.log('getCell,DATA in:',Date.now()-start)

    }

}



function incomingPutMsg(msg,soul){//wire listener should get all emitted puts (either from us, or from other peers)
    if(msg && msg.put){
        soul = (soul !== undefined) ? soul : Object.keys(msg.put)[0]
        let putObj = msg.put[soul]
        if(IS_STATE_INDEX.test(soul)){//watching for a change on an index
            let stateAlias = {true:'active',false:'archived',null:'deleted'}
            for (const nodeID in putObj) {
                let {b} = parseSoul(nodeID)
                const state = putObj[nodeID];
                let toBuffer = stateAlias[state]
                setValue([b,nodeID],toBuffer,nodeStatesBuffer)
            }
            if(stateBuffer){
                stateBuffer = !stateBuffer
                setTimeout(dumpStateChanges,50)
            }
        }else if(!/\/UP$/.test(soul) && !TIME_INDEX_PROP.test(soul) && INSTANCE_OR_ADDRESS.test(soul) && !msg['@']){//watching for incoming data
            if(ALL_INSTANCE_NODES.test(soul)){//non-unorderedSet values
                for (const p in putObj) {
                    if(p === '_')continue
                    let addr = toAddress(soul,p)
                    let cVal = cache.get(addr)
                    //console.log('INC DATA; Cache is..',cVal)
                    if(cVal === undefined)continue //nothing is subscribing to this value yet, ignore
                    const v = putObj[p];
                    if(cVal === v)continue //value is unchanged, do nothing
                    let isSet = (typeof v === 'object' && v !== null && v['#'])
                    if(!isSet)sendToCache(soul,p,v)//value changed, update cache; sendToCache will handle Enq dependencies
                    let subs = addrSubs[addr]
                    console.log('NEW ADDR CACHE VALUE:',v, {subs})
                    if(subs === undefined)continue //no current subscription for this addr
                    
                    if(isEnq(v) || isSet)getCell(soul,p,processValue(addr,subs),true,true)//has subs, but value isEnq, get referenced value, then process subs
                    else processValue(addr,subs)(v,addr)//value is a value to return, process subs with value available
                }
            }else if(ALL_ADDRESSES.test(soul)){//this is an unorderedSet, soul is the address
                let cVal = cache.get(soul)
                console.log('INCOMING ADDRESS/SET',soul,putObj,cVal)

                if(cVal === undefined)return //nothing is subscribing to this value yet, ignore
                let v = (Array.isArray(cVal)) ? new Set(cVal) : new Set()
                for (const item in putObj) {
                    if(item == '_')continue
                    const boolean = putObj[item];
                    if(boolean)v.add(item) //added something to the set that wasn't there before
                    else if(!boolean && v.has(item))v.delete(item) //removed something that was previously in the set
                }
                v = [...v]
                let [s,p] = removeP(soul)
                sendToCache(s,p,v)//value changed, update cache; sendToCache will handle Enq dependencies
                let subs = addrSubs[soul]
                if(subs === undefined)return //no current subscription for this addr
                processValue(soul,subs)(v,soul)//value is a value to return, process subs with value available
            }
            
        }else if(/\/UP$/.test(soul) && !TIME_INDEX_PROP.test(soul) && ALL_ADDRESSES.test(soul) && !msg['@']){//UP looking inheritance dependencies
            //this will be for cascade/function stuff
            
        }else if(IS_CONFIG_SOUL.test(soul) && !msg['@']){//watching for config updates
            let type = IS_CONFIG(soul)
            if(!type)return
            let {b,t,r} = parseSoul(soul)
            if(!gbBases.includes(b))return//so we don't load other base configs.
            let data = JSON.parse(JSON.stringify(putObj))
            delete data['_']
            if(type === 'baseConfig'){
                data.props = {}
                data.groups = {}
                data.relations = {}
                data.labels = {}
                let configpath = configPathFromChainPath(soul)
                setValue(configpath,data,gb,true)
            }else if(type === 'typeIndex'){
                for (const tval in data) {//tval '#' + id || '-'+id
                    const boolean = data[tval];
                    let {t,r} = parseSoul(tval)
                    let path = configPathFromChainPath(makeSoul({b,t,r}))
                    let current = getValue(path,gb)
                    if(boolean && !current){//valid things, that is not in gb
                        setValue(path,{},gb)
                    }else if(!boolean && current){//deleted but was active, null from gb
                        setValue(path,null,gb)
                    }
                }
            }else if(type === 'propIndex'){
                for (const p in data) {
                    const boolean = data[p];
                    let path = configPathFromChainPath(makeSoul({b,t,r,p}))
                    let current = getValue(path,gb)
                    if(boolean && !current){//valid things, that is not in gb
                        setValue(path,{},gb)
                    }else if(!boolean && current){//deleted but was active, null from gb
                        setValue(path,null,gb)
                    }
                }
            }else if(['thingConfig','propConfig','labelIndex'].includes(type)){
                let configpath = configPathFromChainPath(soul)
                let data = JSON.parse(JSON.stringify(putObj))
                delete data['_']
                if(data.usedIn)data.usedIn = JSON.parse(data.usedIn)
                if(data.pickOptions)data.pickOptions = JSON.parse(data.pickOptions)
                setValue(configpath,data,gb,true)

            }
            if(['typeIndex','propIndex','labelIndex'].includes(type))return
            let values = JSON.parse(JSON.stringify(getValue(configPathFromChainPath(soul),gb)))
            for (const subID in configSubs) {
                const {cb,soul:cSoul} = configSubs[subID];
                if(cSoul === soul){
                    cb(values)
                }
            }
        }
    }
}