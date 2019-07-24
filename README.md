# gundb-gbase
gundb-gbase is a wrapper around Gun(^0.9.x)

This is sort of a command line (or console if you expose gbase to window) tool to help organize and connect nodes in graph. It echoes of Neo4j, but approaches lables/node typing differently. This is currently a WIP so beware. Everything will change and data on disk will break.

[API Docs](#api-docs)

# Features
* Define nodeTypes with properties that gbase will enforce such as uniqueness*, data type, incrementing*, etc,
* Indexing nodes by adding 'Labels'
* Relating nodes with a relationship
* Basic queries and graph traversal (API works, but is messy)
* Helper chain api functions to list all things given it's context (nodeTypes, relations, or properties on either of them depending on chain context) 
____
(coming soon)
* Derived data (functions will run when dependent data changes)
* Permissions enforced by super peer (group based)

*To the best effort given the limits of how Gun operates underneath
# Example Usage (out of date)

TODO MAKE README INTO STARTUP GUIDE  
MOVE ALL APIs INFO TO SEPERATE DOCS

## Loading gun instance in to gbase
```
import Gun from 'gun/gun';
import {gunToGbase, gbase} from 'gundb-gbase'


let opt = {}
opt.peers = ["http://localhost:8080/gun"]
let gun = Gun(opt);

let bases = ['someID']
let full = true //default false, if true it will load ALL configs for the baseID supplied
gunToGbase(gun,{bases,full},()=>{console.log('gbase chain.api ready!)});
```
## Creating a new Base
```
gbase.newBase('Base Name', permissionsObj, baseID, errCB)
```
There is an optional 4th argument which will be the Base ID. This should be sufficiently unique as a collision on the graph would merge Bases. If nothing is passed in a `'B' + Random 12 digit alpha numeric` will be generated. The return value from the above command will be the Base ID string.

## gbase chain
This is slightly different than the gun.chain api, but the general point is the same. The chain commands change as you traverse the api, for example:
```
//using gbase identifiers
gbase.base('B123456abcdef').nodeType('1tso3').node('!B123456abcdef#1tso3$so3d_239432').subscribe(data => console.log(data))

//using the aliases the user specified
gbase.base('Cool Database').nodeType('People').node('!B123456abcdef#1tso3$so3d_239432').subscribe(data => console.log(data))


```
## Changing configurations
### Change Base/NodeType/Property Name
.config(Obj) will change the configuration settings of the current chain head.
```
gbase.base(BaseID).config({alias: 'New Name'})//Base Name
gbase.base(BaseID).nodeType(type).config({alias: 'New Type Name'})//NodeType Name
gbase.base(BaseID).table(tval).column(pval).config({alias: 'New Property Name'})//Table Name
```

## Adding NodeType(or Relations)/Properties/Nodes
The same chaining concepts apply from above:
```

```
## Importing Data
Currently have an API for .tsv files, not .csv (having a parsing problem with commas on google sheets export)
```
gbase.base(BaseID).importNewNodeType(tsvFileAsText, 'Table Name');
//creates a new table with alias: 'Table Name'
```
importNewTable will create a new table.
importData will import data to an existing table:
```
gbase.base(BaseID).nodeType('Table').importData(tsvFileAsText, ovrwrt, append)
```
ovrwrt & append are booleans. If you only want to update matching rows (matches by first column, and header names) then ovrwrt = true and append = false. Outcomes for other value combinations are left for the reader to ponder.


# Functions
## and derived data (out of date, but intent is to make something like this)
GBase supports functions that can pull data from one layer down (or above) and do math and put the result in the column specified with the function.
```
let BaseID = b123
let userFN = 'SUM({b123/t3/p2},{b123/t3/p4}) * {b123/t3/p6.b123/t5/p1}'
gbase.base(BaseID).table('t3').column('p5').config({GBtype: 'function', fn: userFN})

let b123/t3/r8 = {p0: 'Row 8', p2: 2, p4: 2 p6:[b123/t5/r13]}
let b123/t5/r13 = {p0: 'Row 13', p1:3}

userFN would resolve to:
SUM(2,2) * 3
4 * 3
= 12
*note how functions are resolved before normal order of operations.

Could also be written:
let userFN = '{b123/t3/p2} + {b123/t3/p4} * {b123/t3/p6.b123/t5/p1}'
userFN would resolve to:
2 + 2 * 3
2 + 6
= 8
```
All references must be wrapped in curly braces. The references must be in the format: '{' + baseID + '/' + tValue + '/' + pValue + '}'
If you are referencing a value on another table, seperate the '/' seperated address with a '.' so: {ref1.ref2} reference 1 must be a link column on your current table, ref2 must be a column that will resolve to a value (or another function column, it cannot be another link).

If your referenced column is a `{linkMultiple: true}` column, you MUST wrap the curly braces in a summary function. Current valid functions are: SUM, MULTIPLY, MAX, MIN, AVG, AND, OR, COUNT, COUNTALL, JOIN
JOIN is the only function that takes one argument before the reference, the seperator. Like:
```
'JOIN("-",{b123/t3/p6.b123/t5/p1})'
//note: whitespace is only preserved if it is within quotes " "
```
Functions are completed in this order:  
* {} references are resolved to values
* FN() are resolved next, if there is nested functions, each argument will be resolved before the outer FN computes
* Remaining math is completed (this is skipped if result contains invalid math characters)

#### Functions (helper)
```
//in your function config component
import {fnOptions, fnHelp} from 'gundb-gbase'


//You only need to know the baseID and the table tVal to determine what other tables/columns you can use in your a fn.

this.setState({opts: fnOptions(B123,t0)})

//opts will be:
{t0:{//non link column on this table
  alias: 'T Name',
  tval: t0,
  columns: [{alias: 'Column Name', pval: p3, path: "B123/t0/p3"}]
  },
  t2:{
  alias: 'Other Name',
  tval: t1,
  columns: [{alias: 'Column Name 2', pval: p4, path: "B123/t0/p7.B123/t1/p4"}]
  }
}

fnHelp(SUM) => [first element will be describing the aruments for that function, second element is an array of example usages]
//['value 1, value 2, ...value n', ['SUM(1,1,2) => 4', 'SUM(-2,1,1) => 0' ]]
```



// WIP VVVVVVVVV
____________________________________________

## **Key Concepts**
There are 2 types of nodes in gbase.
* nodeTypes (Things) - These are the nodes in the graph
* Relationships - These are the edges  

Nodes can only connect to other nodes by way of relationships. All nodes of the same type are indexed together, so disconnected nodes are still found.

**/Key Conepts**



# **API Docs**
Chain constructors  
* [base](#base) (not updated)
* [nodeType](#nodeType) (not updated)
* [relation](#relation) (not updated)
* [node](#node) (not updated)
* [prop](#prop) (not updated)
------
Creation API's
* [newNodeType](#newTable) (not updated)
* [newRelation](#newTable) (not updated)
* [addProp](#addProp)
* [newBase](#newBase) (not updated)
* [newNode](#newNode)
* [newFrom](#newRow) (not updated)
------
Data getter/setter APIs
* [relatesTo](#relatesTo) (not updated)
* [edit](#edit)
* [subscribeQuery](#subscribeQuery)
* [retrieveQuery](#retrieveQuery)
* [subscribe](#subscribe)
* [retrieve](#retrieve)


------
Config APIs
* [config](#config) (not updated)
* [getConfig](#getConfig)
-----
Import APIs
* [importNewNodeType](#importNewNodeType)
* [importRelations](#importRelations) (not updated)
-----
Non-chain helper APIs

----





# **gbase Chain -Basic APIs-**
There are `.ls()` and `.help()` functions you can try to access in console to help understand the api chain
```
gbase.help() //show you your current options and commands to pick from

gbase.ls() //should give you all available bases that will work in `.base()` api.

commands themselves should (or will) have a `.help()` log as well like:
gbase.node.help()

```
**You should only really need to know the baseID (basically namespace) you want to look at on the graph, gbase will get everything below it for you and help you through it with the `.ls()` command**
________
### gbase
**gbase**  
This is the chain origination
Example usage:
```
gbase
```
chain options:
[.base()](#base)
[.newBase()](#newBase)
[.node()](#item)
[.getConfigs()](#getConfigs)
________
### base
**base(*\*baseName*)**  
Arugment is optional **IF** you only have loaded a single base config to your current gbase chain  
`baseName = 'Base Alias' || 'baseID`

Example usage:
```
let baseID = B123 //alias of 'ACME Inc.'

gbase.base('ACME Inc.')

gbase.base() //if on startup you specified {bases:[baseID]} (only 1 base)
//OR only specified one after startup with gbase.getConfig('!'+baseID)


```
next chain options:  
[.nodeType()](#nodeType)  
[.relation()](#relation)  
[.importNewNodeType()](#importNewNodeType)  
[.config()](#config)  
[.kill()](#kill)  

________
### nodeType
**table(*tableName*)**  
All arguments are optional. Defaults are:  
`tableName = 'Table Alias' || 'tval'` (ie; 't0' or 't3')

Example usage:
```
gbase.base('ACME Inc.').table('Customers')

```
chain options for **all** table types:
[.row()](#row)
[.column()](#column)
[.newRow()](#newRow)
[.newColumn()](#newColumn)
[.importData()](#importData)
[.subscribe()](#subscribe)
[.retrieve()](#retrieve)
[.associateTables()](#associateTables)
[.config()](#config)
chain options for **'interaction'** table types that are transactional (plus all from above):
[.listItems()](#listItems)
________
### prop
**column(*columnName*)**  
All arguments are optional. Defaults are:  
`columnName = 'Table Alias' || 'tval'` (ie; 't0' or 't3')

Example usage:
```
gbase.base('ACME Inc.').table('Customers').column('First Name')

```
chain options for **all** table types:
[.row()](#row)
[.column()](#column)
[.newRow()](#newRow)
chain options for **'Static'** table types with column type of `'string'` or `'number'`:
[.linkColumnTo()](#linkColumnTo)

base,table,colum,row



### newBase
**newBase(*baseName*, *tableName*, *firstColumnName*, *baseID*)**  
All arguments are optional. Defaults are:  
`baseName = 'New Base'`  
`tableName = 'New Table'`  
`firstColumnName = 'New Column'`  
`baseID = 'B' + Gun.text.random(8)`//'B' + Random 8 Digit alphanumeric

Example usage:
```
gbase.newBase('ACME Inc.','Customers','Customer ID', "B123")
//returns: baseID

```
_________
### newTable
**newTable(*tableName*, *firstColumnName*)**  
All arguments are optional. Defaults are:  
`tableName = 'New Table'`  
`firstColumnName = 'New Column'`  
Note: An error will be thrown if the tableName is not unique for the base.
Example usage:
```
//assume: 'ACME Inc.' has a baseID = "B123"
gbase.base('ACME Inc.').newTable('Items','Part Number')
gbase.B123.newTable('Items','Part Number')
//returns: new table's tval || error object
//these two call are the same.
```
[baseID, tval? Read here](#gbase-vocab)
_________
### addProp
**addProp(*configObj*,*cb*)**  
All arguments are optional.
For valid config options see [config](#config).
Alias must be unique for the thingType you are adding it to.
If you give the configObj.id a value, then it must be unique across all IDs

Example usage:
```
//assume: 'ACME Inc.' has a baseID = "B123" and "Items" = "1tk23k"
gbase.base('ACME Inc.').table('Items').addProp('Vendor',(err,value) =>{
  if(err){//err will be falsy (undefined || false) if no error
    //value = undefined
    //handle err
  }else{
    //err = falsy
    //value = will return the new prop ID
  }
})
```
[baseID, t0, pval? Read here](#gbase-vocab)
_________
### newNode
**newNode(*dataObj*, *cb*)**  
All arguments are optional  
`dataObj = {Column Alias || pval: value} `  
`cb = Function(err, value)`  
Note: A null node will be created if no dataObj provided
Example usage:
```
//assume: 'ACME Inc.' has a baseID = "B123" and "Items" = "1t3ds2"
gbase.base('ACME Inc.').nodeType('Items').newNode({name:'Anvil'})
(can use the current alias for conveinence)

OR
(Preffered method)
gbase.base("B123").nodeType("1t3ds2").newNode({name:'Anvil'})
This will always work (if an alias changes the first method will fail)



--With Data and CB--
gbase.base("B123").nodeType("1t3ds2").newNode({name:'Anvil'}, (err,value) =>{
  if(err){//err will be falsy (undefined || false) if no error
    //value = undefined
    //handle err
  }else{
    //err = falsy
    //value = will return the new nodes ID
  }
})
```
[rowID, rowAlias? Read here](#gbase-vocab)

_________
### edit
**edit(*\*dataObj* OR *\*value*, *cb*, *opts*)**  
cb and opts are optional  
`dataObj = {Prop Alias || PropID: value} || value* `  
`cb = Function(err, value)`  
`opts = {own:false}` See [inheritance](#inheritance) for more info  
**WARNING** If the context is an address you can just give edit the value for that property, the API will effectively do `{[propID]:value}`. If you give it an object **it will not look at the propID/alias in that object**. The api does `{[propID]:Object.values(dataObj)[0]}`  

Example usage (3 chain locations (**2 usages!**)):
```
//assume:
'ACME Inc.'= "B123"
'Items' = '1t2o3'
'Vendor' = '3p3kd'

nodeID = '!B123#1t2o3$abcd'
address = '!B123#1t2o3.3p3kd$abcd'

//because the nodeID or address contains all context, we can skip the middle bits
gbase.node(nodeID).edit({'Vendor': 'Anvils 'r Us'})
gbase.node(address).edit("Anvils 'r us")


//However, the long api is still valid
gbase.base('ACME Inc.').nodeType('Items').node(nodeID).edit({'Vendor': 'Anvils 'r Us'})

gbase.base('ACME Inc.').nodeType('Items').node(nodeID).prop('Vendor').edit("Anvils 'r us")

gbase.base('ACME Inc.').nodeType('Items').node(address).edit("Anvils 'r us")



--With Data and CB--
gbase.node(address).edit("Anvils 'r us", (err,value) =>{
  if(err){//err will be falsy (undefined || false) if no error
    //value = undefined
    //handle err
  }else{
    //err = falsy
    //value will return the nodeID
  }
})
```
[nodeID, address? Read here to understand the terminology used.](#gbase-vocab)
_________
### subscribeQuery
**subscribeQuery(*\*callBack*, *queryArr*, *udSubID*)**  
callBack and queryArr is required, others are optional Defaults:  
`callBack = Function(resultArr) `  
`queryArr = [queryArr]` [More info here](#query)    
`udSubID = Symbol()` If you give it a subID, then be sure it is unique across all of your subscription

Subscribe will fire the callback with the **entire** data set that matches that query on every change.  
**\*Because gbase caches the data, the node objects themselves will be the same objects, so be sure to not to mutate them!**

* **resultArr** - depends on queryArr options, but default is: `[[{}]]`   
`resultArr[0] = [{},{},{}]` This is the first matching 'path' (based on your match and return statements)
`resultArr[0][0] = {prop1: value, prop2: value}`
`resultArr[0][0].prop1 = value`

The *`udSubID`* (user-defined Subscription ID) was added to allow you to fire the `subscribe()` code itself multiple times without setting up multiple subscriptions. If you specify the same subID twice with two different `callBacks`, then the last fired `subscribe()` callBack will be the only callBack that fires (old callBack is replaced). This allows gbase to cache the query result and keep it up to date even if the callback is not currently being used in a UI component.

Data loading and the callBack: Depending on the state of the database and how much data is already loaded the callBack will fire immediately if it has all the data in memory.

Example usage:
```
//assume IDs:
'ACME Inc.'= "B123"
'Items' = '1t2o3'
'Vendor' = '3p3kd'

nodeID = '!B123#1t2o3$abcd'
address = '!B123#1t2o3.3p3kd$abcd'

let CYPHER = ['MATCH (x:Items)'] //if anything has symbols or spaces, backtick 'MATCH (x:`Has Space`)'
let RETURN = [
  {sortBy:['x',['Vendor','DESC']],limit:10},
  {x:{props:['Vendor','Part Number']}}
  ]
let queryArr = [{CYPHER},{RETURN}]
let sub = gbase.base('ACME Inc.').subscribeQuery(function(data){
  if(!Array.isArray(data))handleErr(data)
  else //success
  //data = [
    [{Vendor: "Anvils 'r Us", 'Part Number': 'A123'}],
    [{Vendor: 'Rockets Galore', 'Part Number: 'BIG-BOOM'}]]
}, queryArr,'forUIView')
```
[Read here to understand the terminology used.](#gbase-vocab)
_________
### retrieveQuery
**subscribeQuery(*\*callBack*, *queryArr*)**  
callBack and queryArr is required, others are optional Defaults:  
`callBack = Function(resultArr) `  
`queryArr = [queryArr]` [More info here](#query)    

Exactly the same as `subscribeQuery` except it only fires the callBack once.
_________
### subscribe
**subscribe(*\*callBack*, *opts*)**  
callBack is required, others are optional Defaults:  
`callBack = Function(data, colArr) `  
`opts = {}` See below for options

**WARNING** subscribe is used in **3** ways and the options very for each.
* `gbase.base(baseID).nodeType('Items').subscribe()` **[nodeType subscription](#nodeType-subscription)** 
* `gbase.node(nodeID).subscribe()` **[node subscription](#node-subscription)** 
* `gbase.node(address).subscribe()` **[address subscription](#address-subscription)** 

#### nodeType subscription  
**This is just a wrapper around [subscribeQuery](#subscribeQuery)**
* callback is fired with entire query results on every change.
* since this will never traverse across another nodeType the arguments have been flattened in to one opts object 
* returns array with same structure as [subscribeQuery](#subscribeQuery)

| Opts[key] | default | typeof | usage | Notes |
|---------------|-----------------------------------|----------------|---------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| sortBy | FALSE | array | [('prop Alias'|| propID),('ASC' || 'DESC')] | You can specify multiple sort columns, will sort from left to right in array to break ties. |
| skip | 0 | number | skip first 'x' results |  |
| limit | Infinity | number | limit total results to 'x' |  |
| idOnly | FALSE | boolean | Don't return properties, but perform full query returning only the id's | You can specify properties, and it will generate addresses for them in the metaData |
| returnAsArray | FALSE | boolean | {prop1:value1} or [value1] | For building tables easier |
| propsByID | FALSE | boolean | Default is to return using the current alias, can return using the gbase id for that prop instead |  |
| noID | FALSE | boolean | On the nodeObj there is a non-enumerable |  |
| noAddress | FALSE | boolean | same as 'noID', but for the 'address' non-enumerable property on the nodeObj | Useful for subscribing specific UI components directly to a particular callback on a property. |
| raw | FALSE | boolean | Apply formatting per the configs.format |  |
| subID | Symbol() | string, Symbol | Will be used as the key in the subscription management in gbase. | Should be sufficiently unique |
| props | all active props on this nodeType | array | If you don't specify any, it will get everything that is not hidden, archived, or deleted |  |
| labels | FALSE | array | subset of nodes that have these tags | will implement not tags as well. |
| filter | FALSE | string |  '{property} > 3' Will sub {} with actual value | Uses the [function library](function-library) |
| range | FALSE | object | {from: unix, to:unix} | Many options, see the [query section](#query) |


#### node subscription
This is technically a wrapper around the internal gbase address subscription.
Returns either an array or an object, depending on options (below).

**This caches the object, so each return is the SAME object, be careful not to mutate!**

Only the last two opts are different than the [nodeType subscription](#nodeType-subscription)

| Opts[key] | default | typeof | usage | Notes |
|---------------|-----------------------------------|----------------|---------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| returnAsArray | FALSE | boolean | {prop1:value1} or [value1] | For building tables easier |
| propsByID | FALSE | boolean | Default is to return using the current alias, can return using the gbase id for that prop instead |  |
| noID | FALSE | boolean | On the nodeObj there is a non-enumerable |  |
| noAddress | FALSE | boolean | same as 'noID', but for the 'address' non-enumerable property on the nodeObj | Useful for subscribing specific UI components directly to a particular callback on a property. |
| raw | FALSE | boolean | Apply formatting per the configs.format |  |
| subID | Symbol() | string, Symbol | Will be used as the key in the subscription management in gbase. | Should be sufficiently unique |
| props | all active props on this nodeType | array | If you don't specify any, it will get everything that is not hidden, archived, or deleted |  |
| propAs | FALSE | object | A temporarily different alias for the prop | Current alias or ID as key, value as value for this subscription. **DIFFERENT FORMAT FROM propAs in subscribeQuery** |
| partial | FALSE | boolean | If true and returnAsArray = false, will give partial updates | Will always return a single {key:value} per fire of callback |

#### address subscription
Fires callback with new value on change.

| Opts[key] | default | typeof | usage | Notes |
|-----------|----------|----------------|------------------------------------------------------------------|-------------------------------|
| raw | FALSE | boolean | Apply formatting per the configs.format |  |
| subID | Symbol() | string, Symbol | Will be used as the key in the subscription management in gbase. | Should be sufficiently unique |

Example usage:
```
//assume IDs:
'ACME Inc.'= "B123"
'Items' = '1t2o3'
'Vendor' = '3p3kd'

nodeID = '!B123#1t2o3$abcd'
address = '!B123#1t2o3.3p3kd$abcd'

//nodeType subscribe
let opts = {sortBy: ['Vendor','DESC'], limit: 10, props: ['Vendor','Part Number']}
let sub = gbase.base('ACME Inc.').nodeType('Items').subscribe(function(data){
  if(!Array.isArray(data))handleErr(data)
  else //success
  //data = [
    [{Vendor: "Anvils 'r Us", 'Part Number': 'A123'}],
    [{Vendor: 'Rockets Galore', 'Part Number: 'BIG-BOOM'}]]
}, opts)
...
gbase.base('ACME Inc.').nodeType('Items').kill(sub)


//node subscribe
let opts = {props: ['Vendor','Part Number']}
let sub = gbase.node(nodeID).subscribe(function(data){
  if(data instanceof Error)handleErr(data)
  else //success
  //data = {Vendor: "Anvils 'r Us", 'Part Number': 'A123'}
}, opts)
...
gbase.node(nodeID).kill(sub)


//address subscribe
let opts = {subID: 'watchMe', raw:true}
let sub = gbase.node(address).subscribe(function(data){
  if(data instanceof Error)handleErr(data)
  else //success
  //data = {Vendor: "Anvils 'r Us", 'Part Number': 'A123'}
}, opts)
...
gbase.node(address).kill(sub)
```

When you want to remove this subscription:
```
gbase.node(address).kill(sub)
```
[Read here to understand the terminology used.](#gbase-vocab)

_________
### retrieve
**retrieve(*\*callBack*, *opts*)**  
This is the same as [subscribe()](#subscribe) except that it only fires the callback one time with the data.


## **gbase Chain -Config APIs-**
________
### getConfig  
**getConfig(*cb*, *opts*)**  
cb will fire with the config object for the chain context or for the path provided in opts.

```
opts = {
  path: '!'+baseID (for adding a new base to this gbase chain) || nodeID(for that type config) || address(for that property config)

  subID: If provided, will subscribe and fire callback with full config object at each change

  full: Only used for a '!'+baseID path. Determines whether to do a minimal load, or get all configs
}
```

Example usage:
There are a couple ways to use.
```
//To add a new base to the api chain:
gbase.getConfig(cb,{path:'!B123'}) // if B123 was already mounted to this chain, it would return it't configs

//To get by context
gbase.base('B123').nodeType('Items').getConfig(cb)

//To get by path
nodeID = '!B123#1t2o3$abcd'
gbase.getConfig(cb,{path: nodeID, subID: 'forUI'}) //Will subscribe the nodeType config object
...
gbase.kill('forUI') //config subs are not namespaced by path. It is the only subscription that can killed without context.

```
_________



________
### config
**config(*\*configObj*, *backLinkCol*, *cb*)**  
configObj is required. 

configObj: Base
```
//valid keys
```
configObj: nodeType
```
//valid keys
```
configObj: relation
```
//valid keys
```
configObj: nodeTypeProp
```
//valid keys
```
configObj: relationProp
```
//valid keys
```

Example usage:
```


```
_________

## **gbase chain - Import APIs -**
### importNewNodeType
**importNewNodeType(*\*(tsv || array)*, *configObj*,*opts*, *cb*)**
This api is for importing a new node type in to gbase, building the configs from the data.

tsv || array = should have a single header row for the properties on each node.  Should be 2D `[[headerRow],[dataRow1],[dataRow2],etc]`
configObj = for this nodeType (not any of the properties). For more info see [config options](#config-options).
opts = {labels: 'Header Name that contains anything that has labels you want to tag the nodes with'}
cb = function(error||undefined). If there is an error, the cb will fire with an error object, otherwise it will return the new node type id

Usage:

```
gbase.base(baseID).importNewNodeType(data,{alias: 'Things'},false,console.log)
```


## GBase Helper Functions

# Query
Currently query is really messy. This may change and will probably be the most fragile part of the gbase api.
**Below are the arguments for `subscribeQuery(cb,**queryArr**)`, however `gbase.base().nodeType().subscribe()` uses these same arguments, they are formatted in a more conveient object to pass in.**

Currently all queries need to have at least a single [CYPHER](#cypher) statement and a single [RETURN](#return) statement. The other arguments [STATE](#state), [RANGE](#range), [FILTER](#filter) are optional.

Below we will be creating a single query thoughout all of the examples here is the data they are searching through:  

Note: 'Joined' is a gbase propType = 'date', is actually a unix number.
(a:Person {Name: 'Alice', Age: 34, Joined: 8/15/18})  
(b:Person {Name: 'Bob',   Age: 35, Joined: 1/18/19})  
(c:Person {Name: 'Carol', Age: 33, Joined: 4/26/19})  

(a)-[:FRIENDS_WITH {since: 2000}]-(b)  
(a)-[:FRIENDS_WITH {since: 2002}]-(c)
(b)-[:FRIENDS_WITH {since: 2001}]-(c)

_________
## CYPHER
**{CYPHER: [*\*cypherString* ]}**
A single item in the array, that is a string. ALL QUERIES MUST HAVE A CYPHER STATEMENT

**THIS IS CURRENTLY LIMITED TO A VERY SIMPLE FORM OF *MATCH***  
Currently valid Arguments:
* 'MATCH ()'
* 'MATCH ()-[]-()' 
* 'MATCH ()-[]->()<-[]-()' You can continue with as many of them as you would like, and can use direction.

Currently valid () & [] (elements) internal arguments:
* () OR [] Unidentified element
* (x) OR [x] Just naming an element for use later in the query
* (x:Person) OR [x:FRIENDS_WITH] Element with name and a label (or nodeType, they are treated the same)
* (:Person:\`label with spaces\`) Multiple labels, anything that has **symbols or spaces** needs to be in backticks
* (:Person:!Online) Not labels have '!' before the label name. Get things that have the Items label but do not have the 'Online' label.
* [x:FRIENDS_WITH|RELATED_TO] Can allow OR by using a vertical bar between relations (no colon).


As you can see, there is no filtering in the match statement. The match statement is only for giving us the pattern.

Full Cypher argument:
```
let queryArr = []
let cypher = {CYPHER:['MATCH (p:Person)']}
queryArr.push(cypher) //order does not matter in the query array

(we will use this argument below on all of the other examples)
```
Further filtering and refinement of the query will be specified in the other arguments we add to queryArr
_________
## RETURN
**{RETURN: [*\*returnConfig*, *\*namedElement_1_Config*, ...*namedElement_n_Config*]}**  
The first two elements in the array are required, accepts as many additional aruments as named elements from the match statement. ALL QUERIES MUST HAVE A RETURN STATEMENT  

The order of the **namedElementConfigs** will effect the order in which they return in the second array ('j' value)

Results will be:  
i = the matched path  
i,j = the particular node in that particular path  
and if **returnAsArray** = `true` then:  
i,j,k = the particular property (value) in the 'j' node in the matched path 'i'  
'k' will be determined by the order you added the props in to the 'props' array in the namedElementConfig.

### **returnConfig**:
| returnConfig[key] | default | typeof | usage | Notes |
|-----------|----------|---------|-------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| sortBy | FALSE | array | [element,('prop Alias' OR propID),('ASC' OR 'DESC')] | Element, is the name you gave the element in match. You can specify multiple sort properties, but only one element. Sort happens from left to right in array to break ties. |
| skip | 0 | number | skip first 'x' results |  |
| limit | Infinity | number | limit total results to 'x' |  |
| idOnly | FALSE | boolean | Don't return properties, but perform full query returning only the id's | You can specify properties, and it will generate addresses for them in the metaData |

### **namedElementConfig**:
Will take the shape of `{[elementName]: configs}` Below is the options for the 'configs' object:

| configs[key] | default | typeof | usage | Notes |
|---------------|-----------------------------------|---------|---------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| returnAsArray | FALSE | boolean | {prop1:value1} or [value1] | For building tables easier |
| propsByID | FALSE | boolean | Default is to return using the current alias, can return using the gbase id for that prop instead | {Name: 'Bob'} vs {2p2j3: 'Bob'} (latter is how it is stored in the database) |
| noID | FALSE | boolean | On the nodeObj there is an 'id' non-enumerable property with the nodeID | data[0][0] = {Name: 'Bob'}  data[0][0].id = '!baseID#1t3k$10d_3993' |
| noAddress | FALSE | boolean | same as 'noID', but for the 'address' non-enumerable property on the nodeObj | Useful for subscribing specific UI components directly to a particular callback on a property. |
| raw | FALSE | boolean | Apply formatting per the configs.format | See [format options](#format-options) |
| idOnly | FALSE | boolean | Don't return properties, but only the ID for this particular element | You can specify properties, and it will generate addresses for them in the metaData |
| props | all active props on this nodeType | array | If you don't specify any, it will get everything that is not hidden, archived, or deleted |  |

Full Cypher argument:
```
let queryArr = []
let cypher = {CYPHER:['MATCH (p:Person)']}
queryArr.push(cypher) //order does not matter in the query array
let returnArg = {RETURN:
  [
    {sortBy:['p','Name','DESC']}, //returnConfig
    {p: {props: ['Name','Age']} //namedElementConfig
  ]}
}
queryArr.push(returnArg)

gbase.base(baseID).subscribeQuery(function(data){
  data = [
  [{Name: 'Alice', Age: 34}],
  [{Name: 'Bob', Age: 35}],
  [{Name: 'Carol', Age: 33}]
  ]
  data[0][0].id = !baseID#typeID$aliceID

  data[0][0].address = 
  [!baseID#typeID.nameID$aliceID,
  !baseID#typeID.ageID$aliceID]

},queryArr)

```
Further filtering and refinement of the query will be specified in the other arguments we add to queryArr
_________

_________
## RANGE
**{RANGE: [*\*element*, *configObj*]}**

**element**:  
This is simply the name you gave the element in the MATCH statement

**configObj**:  
Has keys of property names, and values of `rangeParameters` objects.  
Should look like:
```
configObj = {'Last Login':rangeParameters}
**NOTE**: property must be have a propType: date
```
**rangeParameters**:  
Below is a table explaining the usages.  
NOTE: All arguments are optional, however if some are specified others cannot be. **If you specifiy `relativeTime`, `toDate`, or `lastRange` you cannot specify a `from` or `to`**

| rangeParameters[key] | default | typeof | usage | Notes |
|----------------------|-----------|--------|----------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| from | -Infinity | number | someDateObject.getTime() | Must be a unix timestamp |
| to | Infinity | number | someDateObject.getTime() | Must be a unix timestamp |
| relativeTime | FALSE | string | Sets `from` based on argument.  Format: Number() + oneOf['y','w','d','h','m'] | 50d would set `from` = Date.now()-50 days;  10w would set `from` = Date.now()-70 days;  30m would set `from` = Date.now()-30 minutes |
| toDate | FALSE | string | Sets `from` based on argument.  'year','month','week', 'day'... toDate | value of 'month' would set `from` to first ms in current month |
| lastRange | FALSE | string | Sets `from` and `to` based on arguements.  LAST...  'year','quarter','month','week', 'day', 'hour' | value of 'month' would set `from` to first ms in LAST month and `to` to last ms in LAST month. |
| firstDayOfWeek | 0 | number | Used to modify the 'lastRange' date so you can get the correct 'last week' | 0 = Sunday, 6 = Saturday |

Full Cypher argument:
```
let queryArr = []
let cypher = {CYPHER:['MATCH (p:Person)']}
queryArr.push(cypher) //order does not matter in the query array
let returnArg = {RETURN:
  [
    {sortBy:['p','Name','DESC']}, //returnConfig
    {p: {props: ['Name','Age']} //namedElementConfig
  ]}
}
queryArr.push(returnArg)

let range = {RANGE:['p',{Joined:{from:new Date(1/1/19).getTime()}}]}
queryArr.push(range)

gbase.base(baseID).subscribeQuery(function(data){
  data = [
  [{Name: 'Bob', Age: 35}],
  [{Name: 'Carol', Age: 33}]
  ]
},queryArr)

```
_________
## FILTER
**{FILTER: [ *\*fnString* ]}**  
`fnString` is a string that will be evaluated against each node. It is looking for a true or false return and uses the [function library](#function-library) underneath, see [Functions](#functions) for more detail. The only difference is that the reference to the property is simply the property alias (or ID) in brackets: `{Name}`.
An example on how to filter column 'Age' on a value '30': `'{Age} = 30'`. If you are filtering using a number you can use the following comparators: <, >, =, !=, <=, >=. If you are trying to exact match a string, then you can only use: =, !=. If you want to use regex, see the [TEST](#test) function.


Full Cypher argument:
```
let queryArr = []
let cypher = {CYPHER:['MATCH (p:Person)']}
queryArr.push(cypher) //order does not matter in the query array
let returnArg = {RETURN:
  [
    {sortBy:['p','Name','DESC']}, //returnConfig
    {p: {props: ['Name','Age']} //namedElementConfig
  ]}
}
queryArr.push(returnArg)

let range = {RANGE:['p',{Joined:{from:new Date(1/1/19).getTime()}}]}
queryArr.push(range)

let filter = {FILTER:['{Age} > 33']}
queryArr.push(filter)

gbase.base(baseID).subscribeQuery(function(data){
  data = [
  [{Name: 'Bob', Age: 35}]
  ]
},queryArr)

```
_________
## STATE
**{STATE: [ *\*configObj* ]}**  
This is to determine which states are allowed while traversing a path on any given element in MATCH.  

configObj will have keys of 'element' names and value of an array with valid values of:  
* 'active'
* 'archived'

This will only pass the node if it's 'state' is included in the array. Default value = `['active']`


Full Cypher argument:
```
let queryArr = []
let cypher = {CYPHER:['MATCH (p:Person)']}
queryArr.push(cypher) //order does not matter in the query array
let returnArg = {RETURN:
  [
    {sortBy:['p','Name','DESC']}, //returnConfig
    {p: {props: ['Name','Age']} //namedElementConfig
  ]}
}
queryArr.push(returnArg)

let range = {RANGE:['p',{Joined:{from:new Date(1/1/19).getTime()}}]}
queryArr.push(range)

let filter = {FILTER:['{Age} > 33']}
queryArr.push(filter)

let state = {STATE: {p:['active','archived']}}
queryArr.push(state)


gbase.base(baseID).subscribeQuery(function(data){
  data = [
  [{Name: 'Bob', Age: 35}]
  ]
},queryArr)

```
_________


# GBase Vocab
GBase has many concepts that are referenced in the docs. Here are some definitions:
* **baseID**: The uuid/identifier of the base
* **nodeID**: In gbase, this ID reference a **whole** node. ID will contain the following symbol identifiers !#$ for nodes !-$ for relations
* **address**: In gbase, this ID reference a **single** property on a node. ID will contain the following symbol identifiers !#.$ for nodes !-.$ for relations. This is the level that gbase operates on.
* **externalID**: This is the property that we are keeping values unique on as a secondary identifer to the gbase ID.
* **path**: path is similar to we file path /baseID/ThingType/Prop would be equal to !baseID#Thing.Prop using the gbase identifiers. However /baseID/ThingType/Node/Prop would be in a different order (fixed ordering for gbase IDs) !baseID#ThingType.Prop$Node
* **Source**: This is part of how relationships are conceptualized. `"source"` is the node that is linking **to** another node. Thought of as 'outgoing' relation
* **Target**: Opposite of 'source'. This has an 'incoming'  relation **from** a 'source' node.

### FAQs
Will fill this out as I receive feedback.


# Credit
* Would like to thank @amark for building [GunDB](https://gun.eco/docs/Introduction). Very cool project and a new way to interact with data. Excited to see this project grow with the future development with AXE and the other ecosystem products he is working on.
* Everyone on the [GunDB Gitter](https://gitter.im/amark/gun) who helped answer my questions!