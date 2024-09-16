importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.RepoUtils.js
//@include lib_sol.common.StringUtils.js
//@include lib_sol.common.AclUtils.js
//@include lib_sol.common.ObjectFormatter.js

/**
 * Retrieves sords using a search (findByIndex) or by predefined ids and formats the retrieved sords according to
 * the output parameter. If fuzzy search (getContextTerms) is used, the output parameter is ignored since this
 * search variant returns value groups just like an SQL GROUP BY query.
 *
 * This service is optimized by analyzing defined search terms and output options to retrieve the results in the
 * fastest way possible. Additionally, this service caches a subset of analyzed parameters on demand to further
 * improve execution time.
 *
 * ### Searching
 *
 * Two search variants are provided. findByIndex and getContextTerms
 *
 * #### Search Definition
 *
 * Both search variants use the same search definition. This makes it easier to switch between variants if needed.
 * FindByIndex is used as a default.
 *
 * A search definition contains a `masks` property and a `search` property, which in turn contains additional search criteria.
 *
 * The masks property is an Array of Strings, where each string must define a mask to include in the search.
 *
 *     masks: ["My Mask", "My Mask 2"]
 *
 * The search `property` can contain search criteria.
 *
 *     search: [
 *       { key: "SOL_TYPE", value: "RECRUITING_CANDIDATE" },
 *       { key: "DEPARTMENTS", value: ["Sales", "Purchasing"] },
 *       { key: "ACTIVITYSTATUS", value: "A - *"},
 *       { key: "SOL_REFERENCE", value: "REF-0001¶REF-0002"}
 *     ]
 *
 * Hint: Sordprovider search values provides MultiIndex strings. If the string contains a pilcrow
 * the value will be converted to ["REF-0001", "REF-0002"]
 *
 * You must also define an output definition. (see further below)
 *
 * To search for a date field, use the standard ELO syntax (YYYYMMDDHHMM or YYYYMMDD), but also define the property "type: date".
 *
 *     "search": [
 *       { "key": "INVOICE_DATE", "value": "197310160000...202309300000", "type": "date" }, // range
 *       { "key": "RETRIEVAL_DATE", "value": "-0000-00-30...+0000-00-00", "type": "date" }  // range using offset (-30days to today)
 *     ]
 *
 * If you need to search for an xDateIso or iDateIso, simply define XDATEISO or IDATEISO as the search-key.
 *
 * Date searches are only implemented for FindByIndex searches. Fuzzy/FindDirect searches will not work!
 *
 * If you need to search for a name, simply define name as the search-key
 *
 *    "search": [
 *        { "key": "name", value: "shortDescription"}
 *    ]
 *
 * Attention: A search via the short name always leads to a full table scan on the database.
 * The query is very slow with large databases.
 *
 *
 * #### Fuzzy Search (getContextTerms)
 *
 * Fuzzy search can be used if the results need to be grouped.
 * Fuzzy means, the result is not guaranteed to reflect the current state of the ELO sql database.
 * Fuzzy search and therefore getContextTerms queries iSearch which uses another higher performance
 * database containing possibly out of date values. (Re-indexing takes place about every minute)
 *
 * If you need 100% valid results you must not use fuzzy search. If speed matters most and you only need
 * an estimated grouped result, you may use fuzzy search.
 *
 * Example for a fuzzy search grouped by field/property "a"
 *
 *     results before grouping:
 *       [{ a: "test", b: "rest" }, { a: "now", b: "test" }, { "a: test", c: "what" }]
 *     results after grouping:
 *       {test: 2, now: 1}
 *
 * Note: when using fuzzy search, you only have access to the `results after grouping`.
 *
 * To activate fuzzy search, define
 *
 *     options: {
 *       fuzzy: { groupBy: { type: "GRP", key: MY_GROUPING_FIELD  } } // only GRP supported for now
 *     }
 *
 * You can limit the number of returned groups by defining
 *
 *     options: {
 *       fuzzy: { groupBy: { type: "GRP", key: MY_GROUPING_FIELD  }, maxGroups: 20 }
 *     }
 *
 * ##### Case Sensitivity
 *
 * To turn off case sensitivity, define `ignoreCase: true` in the search definition for the respective field:
 *
 *     search: [
 *       { key: "SUBJECT", value: "Progress", "ignoreCase": true },
 *       { key: "DEPARTMENTS", value: ["Sales", "Purchasing"] }
 *     ]
 *
 * would return e.g.
 *
 *     {Progress: 2, PROGRESS: 5, progreSs: 1}
 *
 * #### FindDirect search
 *
 * To use findDirect as the search mode (will additionally search in memos, fulltext,...), pass
 *
 *     options: {
 *       findDirect: true
 *     }
 *
 * If you need to define a custom query term, pass
 *
 *     options: {
 *       query: "your term"
 *     }
 *
 * If a query is passed, you don't have to pass `findDirect: true` also.
 *
 * #### Tokenization (findDirect only)
 *
 * To search in the tokenized elastic search field, define `tokenized: true` in the search definition for the respective field:
 *
 *     search: [
 *       { key: "SUBJECT", value: "Progress", "tokenized": true },
 *       { key: "DEPARTMENTS", value: ["Sales", "Purchasing"] }
 *     ]
 *
 * #### Sanitize value
 * By default search Values will be sanitized to remove possible escape characters (hyphen), blank values and double/triple whitespaces.
 * To disable sanitation of these values you can disable it seperatly. Please be careful, without sanitation it will be easier to generate wrong search queries.
 *
 * E.g.
 *      search: [
 *        { key: "A_KEY", value: "A_VALUE-WITH_HYPHEN", sanitize: { escapeValues: false } },
 *        { key: "A_KEY", value: "A_VALUE-WITH_HYPHEN", sanitize: { blankValues: false } },
 *        { key: "A_KEY", value: "A_VALUE-WITH_HYPHEN", sanitize: { removeDupWhiteSpaces: false } }
 *      ]
 *
 *
 * #### Paged Searching
 *
 * If you know there will be lots of results, it may make sense to use a paged search.
 *
 * To activate paging, define
 *
 *     options: { paging: true }
 *
 * The service result will then contain an additional property `searchId`, which is a unique search id.
 *
 *     {
 *       searchId: "(141DD-12QW-46GS-9928JJ)",
 *       moreResults: true,
 *       sords: [...]
 *     }
 *
 * If you want to fetch the next batch of results, call the service again by replacing the `paging: true` with `searchId` and the received id:
 *
 *     {
 *       options: { searchId: "(141DD-12QW-46GS-9928JJ)" }
 *     }
 *
 * The last batch of results will neither contain a search id nor the moreResults property.
 *
 * ##### Controlling paging
 *
 * Define the following, to retrieve 10 search results starting from the 131st result.
 *
 *     {
 *       options: { searchId: "(141DD-12QW-46GS-9928JJ)", startPagingFrom: 130, pageSize: 10 }
 *     }
 *
 * You can define any integer greater than -1 as startPagingFrom.
 * When there are no more results, instead of throwing an exception, an empty result.sords array will be returned.
 *
 * ### Page sizes
 *
 * You can define how many results should be delivered per batch by defining a `pageSize`
 *
 *     {
 *       options: { pageSize: 100 }
 *     }
 *
 * Page sizes greater than 1000 are not allowed and will automatically be reduced to 1000.
 *
 * To end a paged search/close a search, pass
 *
 *     {
 *       options: { searchId: "(141DD-12QW-46GS-9928JJ)", endPaging: true }
 *     }
 *
 * This will return `{ sords: [] }`.
 *
 * If you try to fetch results for a searchId which has been closed, an exception will be thrown.
 *
 * ### Formatting
 *
 * Search results will be processed by a formatter. The formatter options must be provided in the `output` parameter.
 *
 *     output: [
 *       { source: { type: "SORD", "key": "guid" }, target: { prop: "id" } },
 *       { source: { type: "MAP", "key": "MY_MAP_FIELD" }, target: { prop: "myprop" } }
 *     ]
 *
 * If 3 sords were found during search, these formatter options would result in
 *
 *     {
 *       sords: [
 *         { id: "(345AD-DFS22-2FSF3-121WD)", myprop: "Testvalue" },
 *         { id: "(3573D-DF6522-2FAVF3-1SDD)", myprop: "Another value" }
 *         { id: "(3J5AD-DFQQ2-2FSFY-12G)", myprop: "Result 3" }
 *       ]
 *     }
 *
 * #### Wildcards for retrieving an unknown amount of MAP/BLOB fields having prefix x
 *
 * You can include MAP-fields in the output using a wildcard. This can be handy if you don't
 * know how many MAP-fields with a specific prefix will exist in the sord.
 *
 *     output: [
 *       { source: { type: "MAP", "key": "LOCALE_*" }, target: { prop: "*" } }
 *     ]
 *
 * Hint: `prop` will be ignored, you can define whatever you like. However, to make clear what you want to do, please define `"*"` or similar.
 *
 * This would output e.g.:
 *
 *     {
 *       sords: [
 *         { LOCALE_APPLE: "sol.lang.apple", LOCALE_NEW: "sol.lang.new" },
 *         { LOCALE_APPLE: "sol.lang.apple", LOCALE_NEW: "sol.lang.new", LOCALE_TREE: "sol.lang.tree" },
 *       ]
 *     }
 *
 * #### Receive permissions on each result sord object
 *
 * If you want to checkout aclItems, `SordProvider` supports the concepts of converter. At the moment `SordProvider`
 * supports two converters to convert `sord.aclItems`.
 *
 * Either you can return the accesscode of the sord object or you can define `aclItems` output definition
 * to return permission object like in the example.
 *
 * When you define aclItems without an explicit converter, each time the converter for the access code is used
 * automatically. It will be thrown an exception if the converter is unknown.
 *
 * Hint: converter prop of the output definition will only be used for sordKeys currently.
 * Another types are currently not supported like objKeys, mapKeys, formBlobKeys and so on.
 *
 *  output: [
 *       { source: { type: "SORD", "key": "guid" }, target: { prop: "id" } },
 *       { source: { type: "SORD", "key": "aclItems", converter: "ACCESS_RIGHTS_CONVERTER" }, target: { prop: "permission" } }
 *  ]
 *
 * The output will be:
 *
 *      {
 *       sords: [
 *         { id: "(345AD-DFS22-2FSF3-121WD)", permission: { r: true, w: true, d: true, e: true, l: true, p: true} }
 *       ]
 *     }
 *
 * #### Format as TemplateSord
 *
 * Define the parameter
 *
 *     {
 *       options: { formatAsTemplateSord: true }
 *     }
 *
 * When this parameter is defined, the `target.prop` name is ignored by default. A template sord based on the original fieldnames will be created.
 *
 * To use the name defined in `target.prop`, define
 *
 *     {
 *       options: { formatAsTemplateSord: true, ignorePropertyNames: false }
 *     }
 *
 * #### Adding properties with custom values
 *
 * You may want to add a fixed property to every result. This is possible by only defining a target.
 *
 *     output: [
 *       { target: { prop: "myspecialprop", value: "My Fixed Value" } }
 *     ]
 *
 * #### Format with ObjectFormatter
 *
 * You can use ObjectFormatters as defined in lib_sol.common.ObjectFormatter to format the output.
 * To do so, define formatter and config within the `output` parameter, e.g.:
 *
 *     output: {
 *        formatter: 'sol.common.ObjectFormatter.TemplateSord',
 *        config: {}
 *     }
 *
 * the defined option parameter regarding output formatting "formatAsTemplateSord" and "ignorePropertyNames" will be ignored.
 *
 * ### Skipping search and providing ids directly
 *
 * If you only want to use the formatting facilities of this service, you can omit the search definition and
 * just provide objIds/guids directly. The service will automatically determine, whether you passed guids or objIds.
 *
 *     ids: ["12345", "43241"]
 *
 * ObjIds and guids can't be mixed.
 *
 * ### Filtering results
 *
 * When you perform a normal search, results will already be filtered by the search criteria. However, you may also want to filter e.g. based on
 * a search result's MAP field. This is made possible by the `filter` parameter.
 *
 * Also, if you pass guids or objIds instead of searching, you would always receive all of the formatted sords, no matter, which criteria they have.
 * The same filter mechanism can be applied to this use-case.
 *
 * Only properties which are defined as a `target.prop` in the `output`-definition can be filtered.
 *
 * If a sord matches the filter, it will be kept. If it does not match the filter, it will be removed from the result-set.
 *
 * Just like the output-parameter, if using an optimized search, the parsed filter will be cached. This also means, that you can omit it
 * on consecutive calls since it will be ignored anyways.
 * (This can be done e.g. by adding it to the array parameter of the ixUtils.optimizedExecute function.)
 *
 * #### Applying a filter
 *
 *     filter: [
 *       { prop: "soltype", value: "RECRUIT*_*" },
 *       { prop: "status", value: ["A -*", "B -*", "C -*"] }
 *     ]
 *
 * This example would only return sords having a soltype property value of "RECRUIT" + Any characters + "_" + Any characters
 * while also having one of the status values beginning with "A -" or "B -" or "C -".
 *
 * #### Applying a filter in TemplateSord mode
 *
 * If `formatAsTemplateSord: true` is passed as an option, you need to define the whole property path to apply a filter.
 *
 *     filter: [
 *       { prop: "objKeys.soltype", value: "RECRUIT*_*" },
 *       { prop: "mapKeys.status", value: ["A -*", "B -*", "C -*"] }
 *     ]
 *
 *
 * #### Excluding a field only used for filtering from the sord-result
 *
 * If you include a field in the output-definition, just to enable its usage in the filter, you might not want to include
 * the respective field in the end-result. Just add the `exclude:true` property to the desired definition.
 *
 *     filter: [
 *       { prop: "soltype", value: "RECRUIT*_*", "exclude": true },
 *       { prop: "status", value: ["A -*", "B -*", "C -*"] }
 *     ]
 *
 * Hint: excluding a field will not work in TemplateSord mode.
 *
 * ### Options
 *
 * #### Returning sparse results
 *
 * Returns only properties which have a value. Empty strings are not a value.
 *
 * This can further reduce network bandwith if defined.
 *
 *     options: { sparse: true }
 *
 * Hint: Caused by implementation details of the indexserver api, map and formblob values are not included
 * in the result sord in the first place, even if `sparse` is undefined or false.
 *
 * #### Allowing searches without a mask
 *
 * For security reasons, the `search` must always contain a mask. (Read: Must not contain an empty string as mask)
 *
 *     // Not allowed:
 *     1. masks: []
 *     2. masks: [""]
 *     3. masks: ["test", ""]
 *
 * You may accidentally define the third variant, which would produce duplicate results.
 *
 * To allow the second variant or just omit the masks parameter completely, alltogether
 *
 *     options: { allowEmptyMask: true }
 *
 * Tip: If a single mask is defined, the search will be fastest. If you define multiple masks or no masks, the formatter will have
 * to lookup the mask for every sord.
 *
 * #### Limit Search Results
 *
 * You know there are 100000 results in the archive, but you only want 300.
 *
 *     options: { maxResults: 300 }
 *
 * `maxResults` defaults to 5000.
 *
 * ### Optimization
 *
 * To further improve the service's performance, you can make it reuse the parsed formatter definitions.
 *
 * Attention: This should only be used, when it is guaranteed, that the output-parameters stay the same for
 * every call of the service when using the same optimization id.
 *
 * Note: Optimization can not be used with fuzzy mode. (Since there is no output parameter to cache)
 *
 * To activate optimization, define
 *
 *     {
 *       optimize: true
 *     }
 *
 * The service result will then contain an additional property `optimization`, which is a unique optimization cache Id.
 *
 *     {
 *       optimization: 59921231,
 *       sords: [...]
 *     }
 *
 * When you call the service the next time, you can omit the output parameter and replace the `true` of `optimize` by the id.
 *
 *     {
 *       optimize: 59921231
 *     }
 *
 * This will speed up the function call by some milliseconds. When searching 1000 results, this may not be a big factor,
 * but when only fetching some ids, it will not make much of a difference if you handcode the whole process or just
 * use this function.
 *
 * #### Implementing optimization in a calling class
 *
 * This is a recommendation on how to keep track of the optimization ids in your own class.
 *
 * Set up a class member
 *
 *     _optimizations: {}  // this will be your local cache for storing the optimization ids
 *
 * You can now call sol.common.IxUtils.optimizedExecute whenever you need it.
 *
 *     process: function () {
 *       var me = this, candidates, apples;
 *       candidates = sol.common.IxUtils.optimizedExecute("RF_sol_common_service_SordProvider", me.myConfigForSearchingCandidates, me._optimizations, "candids", ["output"]);
 *       apples = sol.common.IxUtils.optimizedExecute("RF_sol_common_service_SordProvider", me.myConfigForSearchingApples, me._optimizations, "appls", ["output"]);
 *       return [candidates, apples];
 *     }
 *
 * The optimizedExecute function can be used with any function implementing the same behaviour as SordProvider (taking
 * an `optimize` parameter {Boolean|String}, returning an `optimization` {String})
 *
 * The first parameter takes the RF to execute, the second parameter are the arguments passed to the RF (usually an Object).
 *
 * The third parameter defines that we would like to use _optimizations as our optimization id cache.
 *
 * The fourth parameter enables calling the function in an optimized way for different configs.
 *
 * The fifth parameter defines which config-properties should not be transfered to the RF when an optimization is available. E.g. SordProvider does not need the output
 * parameter because it caches the instructions generated from this parameter.
 *
 * You can make up any name for an optimization. However, it should be unique in your class
 * since the name decides on which optimization id will be passed to the RF.
 *
 * ### Examples
 * #### Give an objId, get a guid
 *
 *     Call
 *     { ids: ["12345"], output: [{ source: { type: "SORD", key: "guid" } }] }
 *     Result
 *     { sords: ["(345AD-DFS22-2FSF3-121WD)"] }
 *
 * #### Search without mask, return a single result
 *
 *     Call
 *     {
 *       masks: [""],
 *       search: [
 *         { key: "SOL_TYPE", value: ["RECRUITING_REQUISITION", "RECRUITING_POOL"] }
 *         { key: "RECRUITING_REQUISITION_NO", value: "0001" }
 *       ],
 *       output: [
 *         { source: { type: "SORD" , key: "guid" }, target: { prop: "guid" } },
 *         { source: { type: "GRP" , key: "RECRUITING_REQUISITION_NAME" }, target: { prop: "name" } }
 *       ],
 *       options: {
 *         allowEmptyMask: true,
 *         maxResults: 1
 *       }
 *     }
 *     Result
 *     { sords: [{ guid: "(2A15C78E-866E-D9FE-0A44-832AFFAF85EE)", name: "IT Engineer" }] }
 *
 * #### Search with multiple masks and paging, return 80 results in batches of 50
 *
 * There is one "Recruiting Requisition" in the archive and more than 79 "Recruiting Candidate"s
 *
 *     Call 1
 *     {
 *       masks: ["Recruiting Requisition", "Recruiting Candidate"],
 *       search: [{ key: "RECRUITING_REQUISITION_NO", value: "0001" }],
 *       output: [
 *         { source: { type: "SORD" , key: "guid" }, target: { prop: "guid" } },
 *         { source: { type: "SORD" , key: "name" }, target: { prop: "name" } }
 *       ],
 *       options: {
 *         paging: true,
 *         pageSize: 50
 *       }
 *     }
 *     Result 1
 *     {
 *       sords: [
 *         { guid: "(BEDCE611-7B78-9C48-E9D9-8DFE7A2ABAB3)", name: "Senior IT Engineer (0001)" },
 *         { guid: "(5C9A204C-D16C-4EC8-C5AF-5933ECA37120)", name: "Fesh, Dieter (00234)" },
 *         // 48 more ...
 *       ],
 *       searchId: "(5C041998-C430-11D8-04A8-CA1EC9CC2502)"
 *     }
 *
 *     Call 2
 *     {
 *       options: {
 *         searchId: "(5C041998-C430-11D8-04A8-CA1EC9CC2502)",
 *         startPagingFrom: 49
 *         pageSize: 50
 *       }
 *     }
 *     Result 2
 *     {
 *       sords: [
 *         { guid: "(B57CBBE6-81D8-75CC-836D-26717DDCF7FC)", name: "Monkfish, Thelonious (0005)" },
 *         { guid: "(1A6E094C-A49E-17A9-19B4-FB56A8FD4E04)", name: "Nex, Carl (0001)" }
 *         // 28 more ...
 *       ]
 *     }
 *
 * 
 * @eloas
 * @eloix
 *
 * @author ESt, ELO Digital Office GmbH
 *
 * @requires sol.common.ObjectUtils
 * @requires sol.common.StringUtils
 * @requires sol.common.ObjectFormatter
 * @requires sol.common.AclUtils
 *
 */
sol.define("sol.common.SordProvider", {
  /**
   * @cfg {String} id (optional)
   * A single objId or guid. The sord is fetched, formatted and returned.
   */

  /**
   * @cfg {String[]} ids (optional)
   * An Array of objIds or guids. All sords are fetched, formatted and returned.
   */

  /**
   * @cfg {String[]} masks (optional)
   * Masks which will be included in the search (`OR` concatenation). Define an empty string as array member to include all masks.
   * If all masks are included, the `option.allowEmptyMask` must be true.
   */

  /**
   * @cfg {Object[]} search (optional)
   * @cfg {Object} search.Object
   * @cfg {String} search.Object.key name of field
   * @cfg {String|String[]} search.Object.value search value. If an array is defined, entries will be concatenated with `OR`
   */

  /**
   * @cfg {Object[]} output (optional)
   * @cfg {Object} output.Object
   * @cfg {Object} output.Object.source (optional)
   * @cfg {String} output.Object.source.key name of source field
   * @cfg {String|"SORD"|"GRP"|"MAP"|"FORMBLOB"} output.Object.source.type type of field
   * @cfg {Object} output.Object.target
   * @cfg {String} output.Object.target.prop name of target property
   * @cfg {String} output.Object.target.value (optional) value for property (useful if no `source` defined)
   */

  /**
   * @cfg {Object[]} filter (optional)
   * @cfg {Object} filter.Object
   * @cfg {String} filter.Object.prop name of the property to read. (property must be defined as a `target.prop` in the `output` parameter)
   * @cfg {String|String[]} filter.Object.value filter value. If an array is defined, entries will be concatenated with `bitwise OR`. The filter is to be understood as working like the array.filter method.
   */

  /**
   * @cfg {Object} options (optional)
   * @cfg {Boolean} [options.allowEmptyMask = false] allow `masks` array to have an empty string as member
   * @cfg {Number} [options.maxResults = 5000] maximum results for the search. if paging is active, a maximum of 1000 results is returned per paged search. Paged searches ignore this parameter.
   * @cfg {Boolean|String} [options.paging = false] (optional) if true, searches use paging and return a paging id. If the `paging` value of a result is passed, the paged search is continued.
   * @cfg {Number} [options.pageSize = 1000] (optional) if paging is active. this defines how many results will be returned per search
   * @cfg {Object} options.fuzzy (optional) use getContextTerms instead of findByIndex for searching
   * @cfg {Object} options.fuzzy.groupBy
   * @cfg {String|"GRP"} options.fuzzy.groupBy.type only "GRP" supported so far.
   * @cfg {String} options.fuzzy.groupBy.key name of field to use for grouping
   * @cfg {Number} [options.fuzzy.maxGroups = 25] (optional) maximum groups to be returned
   */

  /**
   * @cfg {Boolean|Number} [optimize = false] (optional) if true, caches analyzed parameters. If the `optimization` value of a result is passed, it will use the cached parameters instead of analyzing again.
   */

  pilcrow: String.fromCharCode(182),

  /**
   * @property {Number} [defaultMaxResults = 5000] Limits how many results will be returned by a search. Overwritten by `options.maxResults` if defined by user
   */
  defaultMaxResults: 5000,

  /**
   * @property {Number} [defaultMaxGroups = 25] Limits how many groups will be returned by a fuzzy search. Overwritten by `options.fuzzy.maxGroups` if defined by user
   */
  defaultMaxGroups: 25,

  /**
   * @property {String} [wildCard = "*"] Character which will be used as the wildcard character in fuzzy searches.
   */
  wildCard: "*",

  /**
   * @property {Number} [pageSizeMax = 1000] Hard limit. How many results are returned per findFirstSords/findNextSords. `pageSize` gets sanitized to this value if it is defined and greater
   */
  pageSizeMax: 1000,

  /**
   * @private
   * mask line mappings for faster access to GRP-field values
   */
  maskObjKeyCache: {},

  /**
   * @private
   * optimized `output` definitions
   */
  manualOptimizationCache: [],

  /**
   * @private
   * current idx and remaining desired results for each search
   */
  searchCache: {},

  /**
   * @private
   * is used as property name, if only ids are returned but direct values are set and no target.prop was defined.
   */
  fallbackIdProp: "id",

  /**
   * @private
   * Use specific SordC for these values.
   */
  BASICSORDKEYS: ["ID", "GUID", "NAME", "DESC", "MASK", "XDATEISO", "IDATEISO", "ACLITEMS"],

  /**
   * @private
   * mb map
   */
  MBS: {
    ID: SordC.mbOnlyId.getBset(),
    GUID: SordC.mbOnlyGuid.getBset(),
    NAME: SordC.mbName,
    DESC: SordC.mbDesc,
    MASK: SordC.mbMask,
    XDATEISO: SordC.mbXDateIso,
    IDATEISO: SordC.mbIDateIso,
    MIN: SordC.mbMin.getBset(),
    GRP: SordC.mbObjKeys,
    ACLITEMS: SordC.mbAclItems
  },

  /**
   * @private
   */
  CONVERTERS: {
    /**
     * Retrieve the acces code of the sord object by the aclItems
     */
    ACCESS_CODE_CONVERTER: function (sord) {
      return String(sol.common.AclUtils.getAccessCode(sord));
    },

    /**
     * Retrieve the rights object {r: true, w: true, ...} of the sord object
     */
    ACCESS_RIGHTS_CONVERTER: function (sord) {
      return sol.common.AclUtils.getAccessRights(sord);
    }
  },

  DEFAULT_CONVERTERS: {
    aclItems: "ACCESS_CODE_CONVERTER"
  },

  /**
   * @private
   * used to decide on which property should be read during formatting
   */
  SORDACCESSORS: {
    SORD: "sordKeys",
    GRP: "objKeys",
    MAP: "mapKeys",
    FORMBLOB: "formBlobs"
  },

  /**
   * @private
   * these values will be escaped in findDirect search queries
   */
  ESCAPE_VALUES: [
    "(-)"
  ],

  /**
   * @private
   * these values will be removed from findDirect search queries
   */
  BLANK_VALUES: [
    "\\[", "\\]", "\\{", "\\}", "=", "\\|", "\\(", "\\)", "\\^", "\\\"", "~", ":", "\\\\", "/", "<", ">", "\\+", "&", "!", "\\?"
  ],

  /**
   * @private
   * helpers for collectDataFromId
   */

  /**
   * @returns {de.elo.ix.Client.Sord[]} sords by objIds
   */
  getSords: function (objIds, sordC) {
    var me = this;

    return (objIds || [])
      .map(function (objId) {
        return me.getSord(objId, sordC || SordC.mbAllIndex);
      });
  },

  /**
   * @returns {de.elo.ix.Client.Sord} sord by objId
   */
  getSord: function (objId, srdC) {
    try {
      return ixConnect.ix().checkoutSord(objId, srdC, LockC.NO);
    } catch (e) {
      throw "SordProvider: could not checkout sord with objId/guid `" + objId + "`";
    }
  },

  sordKeysExtractor: function (result, sord, fields) {
    var me = this, field, i = fields.length, targetProp, ignorePropNames = me.ipn, converterFct;

    while (i--) {
      field = fields[i];
      targetProp = ignorePropNames ? field.key : (field.prop || field.key);

      converterFct = me.getOutputConverterFunction(field);

      if (converterFct) {
        // use selected converter function to convert sord prop to
        // specific result (e.g. use ACCESSRIGHTSCONVERTER) to format
        // aclItems to {r: true, w: true, ...} formatted object
        result[targetProp] = converterFct(sord);
      } else {
        result[targetProp] = String(sord[field.key] || "");
      }
    }
  },

  getOutputConverterFunction: function (field) {
    var me = this, converterFctKey, converterFct;

    if (!sol.common.StringUtils.isBlank(field.converter)) {
      converterFct = me.CONVERTERS[field.converter.toUpperCase()];

      if (!converterFct) {
        throw Error("SordProvider: converter " + field.converter + " does not exist. Only " + Object.keys(me.CONVERTERS) + " are allowed");
      }
    } else {
      converterFctKey = me.DEFAULT_CONVERTERS[field.key];
      converterFct = me.CONVERTERS[converterFctKey];
    }

    return converterFct;
  },

  objKeysExtractor: function (result, sord, fieldMapping, _accessors, mask) {
    var me = this, i = fieldMapping.length, field, fieldNo, d, dLen, str, values, pilcrow = me.pilcrow,
        key, targetProp, ignorePropNames = me.ipn,
        maskObjKeys = (me.maskObjKeyCache[mask || +(sord.mask)])
        || me.generateObjKeyLineMapping(mask || +(sord.mask));

    while (i--) {
      key = (field = fieldMapping[i]).key;
      targetProp = ignorePropNames ? key : (field.prop || key);
      if ((fieldNo = maskObjKeys[key]) !== undefined) {
        if ((dLen = (values = sord.objKeys[fieldNo].data).length) > 1) {
          for ((str = "", d = 0); d < dLen; d++) {
            str += (values[d] || "");
            (d + 1 < dLen) && (str += pilcrow);
          }
          result[targetProp] = str;
        } else {
          result[targetProp] = String(values[0] || "");
        }
      } else {
        result[targetProp] = "";
      }
    }
  },

  mapExtractor: function (sord, mapDomain, fields) {
    return Array.prototype.slice.call((ixConnect.ix().checkoutMap(mapDomain, sord.id, fields, LockC.NO)).items);
  },

  mapKeysExtractor: function (result, sord, fieldMapping, accessors) {
    var me = this, items = me.mapExtractor(sord, MapDomainC.DOMAIN_SORD, accessors.mapKeys), i = items.length, item, targetProp, ignorePropNames = me.ipn;
    while (i--) {
      item = items[i];
      targetProp = ignorePropNames ? item.key : (fieldMapping[item.key] || item.key);
      result[targetProp] = String(item.value);
    }
  },

  formBlobsExtractor: function (result, sord, fieldMapping, accessors) {
    var me = this,
        items = me.mapExtractor(sord, "formdata", accessors.formBlobs),
        i = items.length,
        item, targetProp, ignorePropNames = me.ipn, stream;
    while (i--) {
      stream = (item = items[i]).getBlobValue().getStream();
      targetProp = ignorePropNames ? item.key : (fieldMapping[item.key] || item.key);
      result[targetProp] = String(Packages.org.apache.commons.io.IOUtils.toString(stream, java.nio.charset.StandardCharsets.UTF_8));
      stream.close();
    }
  },

  formatSord: function (sord, formatterConfig, configKeys, accessors, mask) {
    var me = this, result = {}, i = configKeys.length, key;

    while (i--) {
      me[(key = configKeys[i]) + "Extractor"](result, sord, formatterConfig[key], accessors, mask);
    }

    return result;
  },

  formatSordAsTemplateSord: function (sord, formatterConfig, configKeys, accessors, mask) {
    var me = this, result = {}, i = configKeys.length, key;

    while (i--) {
      me[(key = configKeys[i]) + "Extractor"](
        (key === "sordKeys" ? result : (result[key] = {})),
        sord,
        formatterConfig[key],
        accessors,
        mask
      );
    }

    return result;
  },

  collectDataFromId: function (id, instructions, mask) {
    var me = this, sord = {};

    if (instructions.sordZ) {
      sord = me.getSord(id, instructions.sordZ);
    } else if (instructions.formatterRequired) {
      sord.id = id;
    }

    if (instructions.formatterRequired) {
      return me.getFormatter()(
        sord,
        instructions.converterConfig,
        instructions.configKeys,
        instructions.mapAccessors,
        mask
      );
    }

    return sord;
  },

  getFormatter: function () {
    var me = this;

    return me.formatAsTemplateSord
      ? me.formatSordAsTemplateSord.bind(me)
      : me.formatSord.bind(me);
  },

  setUnchangedIdsAsResult: function (resultArr, ids) {
    var me = this, i, len = ids.length;
    me.logger.debug("Mode: Input is output");

    for (i = 0; i < len; i++) {
      resultArr.push(String(ids[i]));
    }

    me.logger.debug(ids.length + " sords processed");
  },

  reinitializeFormatterSettingsIfRequired: function (instructions) {
    if (!instructions.sordZ && !instructions.converterconfig && !instructions.formatterRequired) {
      instructions.formatterRequired = true;
      instructions.sordZ = instructions.idName === "guid" ? SordC.mbOnlyGuid : SordC.mbOnlyId;
      instructions.converterConfig = { sordKeys: [{ key: instructions.idName, prop: "__id" }] };
      instructions.configKeys = ["sordKeys"];
    }
  },

  getIdsOfIds: function (resultArr, ids, instructions) {
    var me = this, i, len = ids.length;
    me.logger.debug("Mode: Get objIds of guids or guids of objIds");

    me.reinitializeFormatterSettingsIfRequired(instructions);

    for (i = 0; i < len; i++) {
      resultArr.push(me.collectDataFromId(ids[i], instructions)["__id"]);
    }

    me.logger.debug(ids.length + " sords formatted");
  },

  defaultDataCollection: function (resultArr, ids, instructions, mask) {
    var me = this;
    me.logger.debug("Mode: Default formatter");

    if (instructions.objectFormatter) {
      me.getFormattedDataCollectionFromObjectFormatter(ids, instructions)
        .map(me.pushToResults.bind(me, resultArr));
    } else {
      (ids || [])
        .map(function (id) {
          return me.collectDataFromId(id, instructions, mask);
        })
        .map(me.pushToResults.bind(me, resultArr));
    }

    me.logger.debug(ids.length + " sords formatted");
  },

  getFormattedDataCollectionFromObjectFormatter: function (ids, instructions) {
    var me = this;

    return (sol.common.ObjectFormatter.format(
      me.getObjectFormatterInput(ids, instructions)
    ) || {}).sords || [];
  },

  pushToResults: function (resultArr, formattedSord) {
    resultArr.push(formattedSord);
  },

  getObjectFormatterInput: function (ids, instructions) {
    var me = this;

    return {
      sords: {
        formatter: instructions.objectFormatter.formatter,
        data: me.getSords(ids, instructions.sordZ),
        config: instructions.objectFormatter.config
      }
    };
  },

  generateObjKeyLineMapping: function (maskName) {
    var me = this, maskLines, result = {}, i, line, DocMaskZ = new Packages.de.elo.ix.client.DocMaskZ();
    me.logger.debug("Preparing cache for mask", maskName);

    DocMaskZ.add(DocMaskC.mbLines);
    i = (maskLines = Array.prototype.slice.call(ixConnect.ix().checkoutDocMask(maskName, DocMaskZ, LockC.NO).lines)).length;

    while (i--) {
      result[(line = maskLines[i]).key] = +(line.id);
    }

    me.maskObjKeyCache[maskName] = result;
    return result;
  },

  prepareMask: function (mask) {
    var me = this;
    me.maskObjKeyCache[mask] || me.generateObjKeyLineMapping(mask);
  },

  addDataCollectedFromIdContainer: function (idContainer, instructions, allCollectedData, ofMask) {
    var me = this,
        mask,
        idsOfMask = idContainer[ofMask],
        idIsObjId = +(idsOfMask[0]) === +(idsOfMask[0]),
        requiredIdIsAvailableId = (instructions.idName === "id" && idIsObjId) || (instructions.idName === "guid" && (!idsOfMask[0].indexOf("(")));

    if (me.shouldUseDefaultDataCollection(instructions)) {
      me.logger.debug("Collecting data for all ids of mask", mask);
      if (instructions.objKeysRequired && (mask = (ofMask === "__nomask" ? undefined : ofMask))) {
        me.prepareMask(mask);
      }
      me.defaultDataCollection(allCollectedData, idsOfMask, instructions, mask);
    } else {
      if (instructions.anIdRequired) {
        instructions.onlyIdsInCollection = true; // this value persists for whole execution
        if (requiredIdIsAvailableId) {
          me.setUnchangedIdsAsResult(allCollectedData, idsOfMask);
        } else {
          me.getIdsOfIds(allCollectedData, idsOfMask, instructions);
        }
      }
    }
    return allCollectedData;
  },

  shouldUseDefaultDataCollection: function (instructions) {
    return instructions.objectFormatter
      || (!instructions.onlyIdsInCollection
        && instructions.converterConfig
        && instructions.formatterRequired);
  },

  processIdContainer: function (idContainer, instructions) {
    var me = this;
    return Object.keys(idContainer || {})
      .reduce(me.addDataCollectedFromIdContainer.bind(me, idContainer, instructions), []);
  },

  /**
   * @private
   * helpers for search
   */

  createObjKey: function (name, value) {
    var key = new ObjKey();
    key.name = name;
    key.data = [value];
    return key;
  },

  parseSearchValue: function (value) {
    var me = this;

    value = sol.common.ObjectUtils.isString(value)
      ? me.convertMultiIndex(value)
      : value;

    // multiIndexValue could be a simple string here as well
    return !Array.isArray(value)
      ? value
      : value.reduce(function (acc, val, i) {
        return me.addOR(acc + '"' + val + '"', i, value.length);
      }, "");
  },

  convertMultiIndex: function (value) {
    var me = this,
        values = value
          .split(me.pilcrow)
          .filter(function (str) {
          // filter out each broken multiIndex value like ¶¶Test
            return str.trim();
          });

    // return simple string when it is a single value because it is faster
    return values.length > 1 ? values : value;
  },

  extractSearchOpts: function (fields) {
    var me = this, opts = {}, objKeys = [];
    if (!Array.isArray(fields)) {
      throw "SordProvider: searchfields must be an array of objects!";
    }
    fields.forEach(function (field) {
      if ((typeof field !== "object") || (typeof field.key !== "string" && field.key) || ((typeof field.value !== "string") && (!Array.isArray(field.value)))) {
        throw "SordProvider: searchfield is no object, or key or value not suited for searching";
      }
      if (Array.isArray(field.value) && !field.value.length) {
        throw "SordProvider: " + field.key + ": it is not allowed to use empty arrays as a search value.";
      }
      if (field.key === "XDATEISO") {
        opts.xDateIso = field.value;
      } else if (field.key === "IDATEISO") {
        opts.iDateIso = field.value;
      } else if (field.key === "name") {
        opts.name = field.value;
      } else {
        objKeys.push(me.createObjKey(field.key, me.parseSearchValue(field.value)));
      }
    });
    if (!(objKeys.length || opts.xDateIso || opts.iDateIso || opts.name)) {
      throw "SordProvider: no search criteria defined!";
    }
    objKeys.length && (opts.objKeys = objKeys);
    return opts;
  },

  buildFindByIndex: function (masks, searchfields) {
    var me = this, findByIndex = new FindByIndex(), opts = me.extractSearchOpts(searchfields);

    opts.objKeys && (findByIndex.objKeys = opts.objKeys);
    opts.xDateIso && (findByIndex.XDateIso = opts.xDateIso);
    opts.iDateIso && (findByIndex.IDateIso = opts.iDateIso);
    opts.name && (findByIndex.name = opts.name);
    findByIndex.maskIds = masks;

    return findByIndex;
  },

  buildFindInfoForFindByIndex: function (masks, searchfields) {
    var me = this, findInfo = new FindInfo();
    me.logger.debug("Building findInfo for findByIndex");
    findInfo.findByIndex = me.buildFindByIndex(masks, searchfields);
    return findInfo;
  },

  buildFindInfoForFindDirect: function (masks, searchCriteria) {
    var me = this, findInfo = new FindInfo(), queryOpts;
    me.logger.debug("Building findInfo for search via mask(s) using findDirect", masks);

    sol.common.ObjectUtils.type(me.query, "string")
      && (queryOpts = { customQuery: String(me.query) });

    findInfo.findDirect = me.buildFindDirect(masks, searchCriteria, queryOpts);
    return findInfo;
  },

  getFindInfoBuilder: function () {
    var me = this;
    return (me.findDirect ? me.buildFindInfoForFindDirect : me.buildFindInfoForFindByIndex).bind(me);
  },

  /**
   * @private
   * helpers for finalizeCollector
   */

  generateMbsFromOptions: function (mbs) {
    var me = this;
    return mbs.map(function (mb) {
      return me.MBS[mb];
    });
  },

  createSordZ: function (mbs) {
    return (mbs.length || undefined)
      && mbs.reduce(function (sordZ, mb) {
        sordZ.add(mb);
        return sordZ;
      }, new SordZ());
  },

  addToOptimizationCache: function (cache, instructions) {
    var me = this;
    me.logger.debug("Storing instructions in optimization cache");
    return me[cache].push(instructions);
  },

  getFromOptimizationCache: function (cache, id) {
    var me = this;
    try {
      return me[cache][id - 1];
    } catch (e) {
      throw "SordProvider: id `" + id + "` not found in optimization cache.";
    }
  },

  getCachedInstructions: function (cacheName, optimization) {
    var me = this;
    return me.getFromOptimizationCache(cacheName + "OptimizationCache", optimization);
  },

  addInstructionsToCache: function (cacheName, instructions) {
    var me = this;
    return me.addToOptimizationCache(cacheName + "OptimizationCache", instructions);
  },

  /**
   * @private
   * helpers for parseOutputDefinition
   */

  addMb: function (mbs, type, key) {
    var me = this, uKey = key.toUpperCase(), mb = (
      ((type === "SORD") && (me.contains(me.BASICSORDKEYS, uKey) ? uKey : "MIN"))
      || ((type === "GRP") && type)
      || ""
    );
    return mb && !me.contains(mbs, mb) && mbs.push(mb);
  },

  addConverterKey: function (converterConfig, type, key, prop, converter) {
    var formatterTarget = this.SORDACCESSORS[type];
    if (!formatterTarget) {
      throw "SordProvider: type " + type + " not supported";
    }
    (type === "SORD" || type === "GRP")
      ? converterConfig[formatterTarget].push({ key: key, prop: prop, converter: converter })
      : converterConfig[formatterTarget][key] = prop; // map/blob definitions stored in objects!
  },

  cleanConfig: function (config) {
    return Object.keys(config).reduce(function (cleanedConfig, key) {
      if (Object.keys(config[key]).length) {
        cleanedConfig[key] = config[key];
      }
      return cleanedConfig;
    }, {});
  },

  formatterIsRequired: function (instructions) {
    var onlyOneMbAndItsNotForAnId = (instructions.mbs.length === 1 && !instructions.anIdRequired),
        multipleMbsRequired = instructions.mbs.length > 1;
    return !!(
      onlyOneMbAndItsNotForAnId // e.g. `DESC`, when only sord.desc is read
      || multipleMbsRequired
      || instructions.converterConfig.objKeys
      || instructions.converterConfig.mapKeys
      || instructions.converterConfig.formBlobs
    );
  },

  calcFlags: function (instructions) {
    var me = this, idRequired, guidRequired;
    me.logger.debug("Calculating flags for generated instructions.");

    idRequired = me.contains(instructions.mbs, "ID") && "id";
    guidRequired = me.contains(instructions.mbs, "GUID") && "guid";
    (instructions.anIdRequired = !!(idRequired || guidRequired))
      && me.logger.debug("Output will contain an objId or guid");

    if (instructions.objKeysRequired = me.contains(instructions.mbs, "GRP")) {
      me.logger.debug("Output will contain GRP-fields");
      ((!me.masks) || me.contains(me.masks, "__nomask"))
        && me.addMb(instructions.mbs, "SORD", "mask") // mask will be read from every sord
        && me.logger.debug("Since no mask was defined, `mask` has been added to SordZ of sord formatter");
    }

    instructions.formatterRequired = me.formatterIsRequired(instructions);
    me.logger.debug((instructions.formatterRequired ? "" : "No ") + "sord formatter will be used.");

    // determines which property will be read from sord when input>output is id>guid or guid>id
    if (instructions.formatterRequired) {
      (instructions.converterConfig.mapKeys || instructions.converterConfig.formBlobs)
        && me.addMb(instructions.mbs, "SORD", "id");
    } else {
      (instructions.idName = idRequired || guidRequired || "id")
        && me.logger.debug(["Using `{0}` as id property.", instructions.idName]);
    }
  },

  optimizeObjectAccessors: function (instructions) {
    var me = this;
    me.logger.debug("Optimizing sord object accessors");
    instructions.configKeys = Object.keys(instructions.converterConfig); // performance opt. for converterConfig
    instructions.mapAccessors = me.cleanConfig({ // performance opt. for keys in configKeys
      mapKeys: Object.keys(instructions.converterConfig.mapKeys || {}),
      formBlobs: Object.keys(instructions.converterConfig.formBlobs || {})
    });
    instructions.dvKeys = Object.keys(instructions.directValues); // performance opt. for directValues
  },

  assignFallbackIdProp: function (instructions, lonelyDef) {
    var me = this;
    function definesIdOrGuid(source) {
      return source.type === "SORD" && (source.key === "guid" || source.key === "id");
    }
    definesIdOrGuid(lonelyDef.source)
      && (instructions.fallbackIdProp = ((lonelyDef.target || {}).prop || me.fallbackIdProp));
  },

  addAsSourceTargetInstruction: function (instructions, source, target) {
    var me = this;
    me.logger.debug("Preparing sord formatter instructions for entry.");
    me.addMb(instructions.mbs, source.type, source.key);
    me.addConverterKey(instructions.converterConfig, source.type, source.key, target.prop, source.converter);
    target && target.prop && instructions.targetProps.push(target.prop);
  },

  addAsDirectValueInstruction: function (instanceScope, instructions, target) {
    var me = this;
    me.logger.debug("Instruction is a direct value.");
    instanceScope._directValuesDefined = true;
    instructions.directValues[target.prop] = target.value;
    instructions.targetProps.push(target.prop);
  },

  isValidSourceDefinition: function (sDef) {
    return typeof sDef === "object" && typeof sDef.type === "string" && typeof sDef.key === "string";
  },

  definesDirectValue: function (isValidTarget, target) {
    return isValidTarget && typeof target.prop === "string" && typeof target.value === "string";
  },

  addOutputInstruction: function (multipleOptsDefined, instructions, outputInstruction, i) {
    var me = this,
        source = outputInstruction.source, target = outputInstruction.target || {},
        validTargetDefinition = !!(target && target.prop);

    me.logger.debug("Processing output instruction " + (i + 1) + ":", outputInstruction);
    if (me.isValidSourceDefinition(source)) {
      if (multipleOptsDefined && !validTargetDefinition) {
        throw "SordProvider: Invalid instruction: each instruction must have a `target.prop`";
      }
      me.addAsSourceTargetInstruction(instructions, source, target);
    } else if (me.definesDirectValue(validTargetDefinition, target)) {
      me.addAsDirectValueInstruction(me, instructions, target);

    } else {
      throw "SordProvider: Invalid instruction: each instruction must have (`source.type`, `source.key` and `target.prop`) or (`target.prop` and `target.value`)";
    }
    return instructions;
  },

  parseOutputDefinition: function (outputDef) {
    var me = this,
        multipleOptsDefined = (outputDef.length > 1),
        instructions = {
          mbs: [], // used for generating a sordZ for CheckoutSord
          // defines, which values will be retrieved from the checked out sord
          targetProps: [], // used when sparse option is set
          converterConfig: { sordKeys: [], objKeys: [], mapKeys: {}, formBlobs: {} },
          directValues: {}
        };
    me.logger.debug("Parsing output definition.", outputDef);

    outputDef.reduce(me.addOutputInstruction.bind(me, multipleOptsDefined), instructions);

    !multipleOptsDefined
      && me._directValuesDefined // defined in addOutputInstruction
      && me.assignFallbackIdProp(instructions, outputDef[0]);

    instructions.converterConfig = me.cleanConfig(instructions.converterConfig);
    me.calcFlags(instructions); // precalculate flags to save time in loops later on
    me.optimizeObjectAccessors(instructions); // cache accessors (Object.keys()) in instructions

    return instructions;
  },

  finalizeCollector: function (instructions) {
    var me = this, mbs,
        onlyOneMbAndItsForAnId = (instructions.mbs.length === 1 && instructions.anIdRequired);

    // only generate a sordZ if more than the ID is to be included in the output
    if (onlyOneMbAndItsForAnId && (instructions.converterConfig && (!instructions.converterConfig.mapKeys && !instructions.converterConfig.formBlobs))) {
      me.logger.debug("No sord formatter will be used");
      instructions.converterConfig = undefined;
      instructions.sordZ = undefined;
      instructions.formatterRequired = false;
    } else {
      // update instruction.mbs array here
      mbs = me.generateMbsFromOptions(instructions.mbs);
      instructions.sordZ = me.createSordZ(mbs);
    }
  },

  idsOf: function (findResult) {
    return (findResult && findResult.ids && Array.prototype.slice.call(findResult.ids)) || [];
  },

  impureConcat: function (target, source) {
    for (var i = 0, len = source.length; i < len; i++) {
      target.push(source[i]);
    }
  },

  updateSearchCache: function (findResult, desiredResults) {
    var me = this,
        cache = (me.searchCache[findResult.searchId] || (me.searchCache[findResult.searchId] = {})),
        results = (findResult.ids && findResult.ids.length) || 0;
    me.logger.debug("Updating search cache");
    cache.idx = cache.idx ? cache.idx + results : results;
    cache.desiredResults = cache.desiredResults ? (cache.desiredResults - results) : (desiredResults - results);
  },

  getFromSearchCache: function (store, searchId) {
    var me = this, cache = me.searchCache[searchId] || {};
    me.logger.debug("Testing cache for search information");
    store.idx = cache.idx;
    store.desiredResults = cache.desiredResults;
  },

  closeFind: function (searchId) {
    var me = this;
    me.searchCache[searchId] = undefined;
    ixConnect.ix().findClose(searchId);
  },

  maintainSearchInfo: function (searchInfo, findResult, maxResults) {
    var me = this;
    if (findResult.moreResults) {
      me.updateSearchCache(findResult, maxResults);
      me.getFromSearchCache(searchInfo, findResult.searchId);
      findResult.moreResults = searchInfo.desiredResults > 0 ? findResult.moreResults : false;
      me.logger.debug(
        ["Found `{1}` results so far, desired remaining results `{1}` "],
        searchInfo.idx, searchInfo.desiredResults
      );
    }
  },

  prepareSearchInfo: function (searchInfo, searchId, maxResults, pageSize) {
    var me = this, desiredResults;
    me.getFromSearchCache(searchInfo, searchId);
    pageSize || (pageSize = me.pageSizeMax);
    desiredResults = searchInfo.desiredResults || maxResults;
    searchInfo.maxSords = (desiredResults <= pageSize ? desiredResults : pageSize); // limit to pagesize

    me.logger.debug([
      "Find by searchId `{0}`, desired result count `{1}`, results so far `{2}`, max results per search `{3}` ",
      (searchId || "N/A (new search)"), searchInfo.desiredResults, searchInfo.idx, searchInfo.maxSords
    ]);
  },

  find: function (findInfo, maxResults, pageSize, sordZ, searchId) {
    var me = this, searchInfo = {}, findResult;

    me.prepareSearchInfo(searchInfo, searchId, maxResults, pageSize);

    if (me.manualPagingFrom === undefined || me.paging === true) {
      findResult = (searchInfo.idx === undefined)
        ? ixConnect.ix().findFirstSords(findInfo, searchInfo.maxSords, sordZ)
        : ixConnect.ix().findNextSords(searchId, searchInfo.idx, searchInfo.maxSords, sordZ);

      me.maintainSearchInfo(searchInfo, findResult, maxResults);

      me.moreResults = !!findResult.moreResults;
      findResult.moreResults
        ? me.logger.debug("More results available. Id: " + findResult.searchId)
        : me.closeFind(String(findResult.searchId));
    } else {
      findResult = ixConnect.ix().findNextSords(searchId, me.manualPagingFrom, searchInfo.maxSords, sordZ);
      findResult.moreResults && (me.moreResults = true);
    }

    return findResult;
  },


  processResult: function (findResult, ids) {
    var result = { ids: ids };
    if (findResult.moreResults) {
      result.paging = String(findResult.searchId);
    }
    return result;
  },

  findAll: function (findInfo, maxResults, sordZ) {
    var me = this, ids = [],
        findResult = { moreResults: true };

    while (findResult.moreResults) {
      findResult = me.find(findInfo, maxResults, undefined, sordZ, findResult.searchId);
      me.impureConcat(ids, me.idsOf(findResult));
    }

    me.logger.debug(["Found {0} results", ids.length]);

    return me.processResult(findResult, ids);
  },

  pageFind: function (findInfo, maxResults, pageSize, sordZ, searchId) {
    var me = this, findResult;

    me.logger.debug("Executing find using paging.");
    me.logger.debug((searchId ? "Continuing" : "Starting new") + " search");
    findResult = me.find(findInfo, maxResults, pageSize, sordZ, searchId);
    return me.processResult(findResult, me.idsOf(findResult));
  },

  findIds: function (masks, searchFields, options) {
    var me = this, paging = options.paging,
        maxResults = (options.maxResults || me.defaultMaxResults),
        pageSize = options.pageSize, sordZ = options.idSordZ,
        result;

    if (options.maxResults <= 0) {
      throw "SordProvider: `options.maxResults` must be greater than 0";
    }
    if (options.pageSize <= 0) {
      throw "SordProvider: `options.pageSize` must be greater than 0";
    }

    if (paging) {
      result = (typeof paging === "boolean") // initialize paging
        ? me.pageFind((me.getFindInfoBuilder())(masks, searchFields), maxResults, pageSize, sordZ)
        : me.pageFind((me.manualPagingFrom === undefined ? undefined : (me.getFindInfoBuilder())(masks, searchFields)), maxResults, pageSize, sordZ, paging); // continue paging search
    } else {
      me.logger.debug("Using standard search");
      result = me.findAll((me.getFindInfoBuilder())(masks, searchFields), maxResults, sordZ);
    }

    return result;
  },

  searchFor: function (infos, searchCriteria, options, masks) {
    var me = this, result, ids, searchResults = { idsByMask: {} };

    result = me.findIds(masks, searchCriteria, options);

    if ((ids = result.ids) && me.manualPagingFrom === undefined) {
      infos.fetched += ids.length;
    }

    ids.length
      && (infos.found = true)
      && (searchResults.idsByMask[((masks.length === 1) && masks[0]) ? masks[0] : "__nomask"] = ids);

    searchResults.paging = result.paging;

    return searchResults;
  },

  searchViaIndex: function (masks, searchCriteria, options) {
    var me = this, infos = {}, result;

    me.logger.debug("... find by index search using search criteria", searchCriteria);

    if (!me.pagingIdDefined(options.paging)) {
      if (!Array.isArray(masks)) {
        if (options.allowEmptyMask === true) {
          me.masks = (masks = [""]);
        } else {
          throw "SordProvider: masks must be an array of strings!";
        }
      }
    }

    infos.fetched = 0;

    result = me.searchFor(infos, searchCriteria, options, masks);

    infos.pagingId && infos.found && !result.paging && me.endPaging(infos.pagingId);

    return infos.found
      ? (
        me.logger.debug("Search had " + infos.fetched + " results. " + (result.paging ? "Paging active: " + result.paging : "")),
        result
      )
      : (me.logger.debug("No search results"), undefined);
  },

  addDirectValuesToSords: function (sords, instructions) {
    var i = sords.length, dvKeys = instructions.dvKeys,
        k, kLen = dvKeys.length, directValues = instructions.directValues,
        sord, prop;

    while (i--) {
      sord = sords[i];
      k = kLen;
      while (k--) {
        prop = dvKeys[k];
        sord[prop] = directValues[prop];
      }
    }
    return sords;
  },

  addDirectValuesToIds: function (ids, instructions) {
    var fallbackIdProp = instructions.fallbackIdProp, i, iLen = ids.length, dvKeys = instructions.dvKeys,
        k, kLen = dvKeys.length, directValues = instructions.directValues,
        sord, prop, sords = [];

    for (i = 0; i < iLen; i++) {
      sord = {};
      sord[fallbackIdProp] = ids[i];
      k = kLen;
      while (k--) {
        prop = dvKeys[k];
        sord[prop] = directValues[prop];
      }
      sords.push(sord);
    }
    return sords;
  },

  buildIdContainer: function (inputIds) {
    var me = this, idContainer = { __nomask: [] };

    inputIds || (inputIds = {});

    if (Array.isArray(inputIds)) {
      me.logger.debug("Processing ids passed via parameter. No search preceded.");
      idContainer.__nomask = inputIds;
    } else if (typeof inputIds.idsByMask === "object") {
      me.logger.debug("Processing ids collected via search.");
      idContainer = inputIds.idsByMask;
    } else {
      me.logger.debug("Processing a single id. No search preceded.");
      idContainer.__nomask.push(inputIds); // single id from parameter
    }

    return idContainer;
  },

  processIds: function (inputIds, instructions) {
    var me = this,
        sords,
        idContainer;

    idContainer = me.buildIdContainer(inputIds);
    me.finalizeCollector(instructions);
    sords = me.processIdContainer(idContainer, instructions);

    return (instructions.dvKeys.length)
      ? (
        (instructions.onlyIdsInCollection
          ? me.addDirectValuesToIds
          : me.addDirectValuesToSords
        )(sords, instructions))
      : sords;
  },

  removeEmptyFields: function (sords, props) {
    var i = sords.length, k, kLen = props.length, sord, prop;
    if (!kLen) {
      return; // no props to check
    }
    while (i--) {
      sord = sords[i];
      k = kLen;
      while (k--) {
        (sord[(prop = props[k])] === "") && (sord[prop] = undefined);
      }
    }
  },

  propsToArrays: function (sords, props) {
    var me = this, i = sords.length, k, kLen = props.length, sord, prop, arr,
        pilcrow = me.pilcrow;
    if (!kLen) {
      return; // no props to check
    }
    while (i--) {
      sord = sords[i];
      k = kLen;
      while (k--) {
        arr = (sord[(prop = props[k])] = (sord[prop] || "").split(pilcrow));
        (arr.length === 1 && arr[0] === "") && (sord[prop] = []);
      }
    }
  },

  fastFilter: function (sords, filter) {
    var i = 0, iLen = sords.length, curSord, prop, k, kLen = filter.length, curFil,
        match, filtered = [];
    for (; i < iLen; i++) {
      curSord = sords[i];
      k = 0;
      while (k < kLen && (match = (curFil = filter[k]).value.test(curSord[(prop = curFil.prop)]))) {
        k++, curFil.exclude && (curSord[prop] = undefined);
      }
      match && filtered.push(curSord);
    }
    return filtered;
  },

  templateSordFilter: function (sords, filter) {
    var i = 0, iLen = sords.length, curSord, k, kLen = filter.length, curFil,
        match, filtered = [];
    for (; i < iLen; i++) {
      curSord = sords[i];
      k = 0;
      while (k < kLen && (match = (curFil = filter[k]).value.test(sol.common.ObjectUtils.getProp(curSord, curFil.prop)))) {
        k++; // exclude does not work in templateSord mode
      }
      match && filtered.push(curSord);
    }
    return filtered;
  },

  filterSords: function (sords, filter) {
    var me = this;
    return me.formatAsTemplateSord
      ? me.templateSordFilter(sords, filter)
      : me.fastFilter(sords, filter);
  },

  arrayToRegExp: function (arr, wc) {
    var compl, len = arr.length,
        addBitwiseOR = function (query, index, length) {
          return ((index + 1 < length) && (query += "|")), query;
        };

    compl = arr.reduce(function (acc, str, i) {
      if (typeof str !== "string") {
        throw "SordProvider: only string elements are allowed for filter criteria arrays";
      }
      return acc + addBitwiseOR("^" + str + "$", i, len);
    }, "");

    return new RegExp(compl.replace(new RegExp("\\" + wc, "g"), "." + wc));
  },


  stringToRegExp: function (str, wc, ignoreCase) {
    return new RegExp("^" + str.replace(new RegExp("\\" + wc, "g"), "." + wc), (ignoreCase ? "i" : ""));
  },

  contains: function (val, s) {
    return !!~val.indexOf(s);
  },

  buildValueQuery: function (key, value, tokenized) {
    var me = this;
    return me.FIND_DIRECT[tokenized ? "FIELD_OBJ_KEY_TOKENIZED" : "FIELD_OBJ_KEY"]
      + key
      + ": "
      + (!me.contains(value, '"') ? '"' + value + '"' : value); // LINE_MYFIELDNAME: "My value"
  },

  /* This is a workaround. getContextTerms does not support wildcards.
   * Therefore before executing the actual search, all available
   * values for the grouping term are collected and then filtered
   * for the defined value, which can contain a wildcard. */
  getAvailableTerms: function (key, value, ignoreCase, findInfo, maxGroups) {
    var me = this, re = me.stringToRegExp(value, me.wildCard, ignoreCase);

    // search for terms of the field `key`
    return me.getContextTerms(
      findInfo,
      me.getGroupingTerm({ groupBy: { type: "GRP", key: key } }),
      (+(maxGroups) || me.defaultMaxGroups)
    )
      .filter(function (result) { // return only terms containing the wildcard value
        return re.test(String(result.term));
      });
  },

  valuesWithoutWildcard: function (criterion) {
    var me = this;
    return !Array.isArray(criterion.value)
      ? !me.contains(criterion.value, me.wildCard) //str
      : !criterion.value.some(function (val) {
        return me.contains(val, me.wildCard);
      });
  },

  getFindInfoForConstantSearchValues: function (masks, searchCriteria, maxGroups) {
    var me = this, constantCriteria = searchCriteria.filter(me.valuesWithoutWildcard.bind(me));

    if (constantCriteria.length !== searchCriteria.length) {
      me.logger.debug("BEGIN: Building supplementary findInfo: searchcriteria contained wildcards");
      return me.buildFindInfoForContextTerms(masks, constantCriteria, maxGroups); //one time recursive call! uses all criteria without wildCards
    }
  },

  addOR: function (query, index, length) {
    return ((index + 1 < length) && (query += " OR ")), query;
  },

  getCriterionQuery: function (key, value, ignoreCase, tokenized, constantCriteriaFindInfo, maxGroups, params) {
    var me = this,
        addTermsToCriterionQuery = function (criterionQuery, term, i, availableTerms) {
          var resTerm = String(term.term);
          (!me.contains(resTerm, me.wildCard))
          && (criterionQuery += me.parens(
            me.getCriterionQuery(
              key,
              me.sanitizeQueryValue(resTerm, params),
              ignoreCase,
              tokenized))); // recursion!
          return me.addOR(criterionQuery, i, availableTerms.length);
        };

    return !me.contains(value, me.wildCard)
      ? me.buildValueQuery(key, value, tokenized)
      : (
        (me.getAvailableTerms(key, value, ignoreCase, constantCriteriaFindInfo, maxGroups)
          .reduce(addTermsToCriterionQuery, ""))
        || me.buildValueQuery(key, value.replace(/\*/g, ""), tokenized)
      );
  },

  addCriterionToQuery: function (maxGroups, supplementaryFindInfo, query, criterion) {
    var me = this,
        criterionQuery,
        addCriterionQueriesForAllValuesToQuery = function (valuePartOfQuery, val, i, values) {
          valuePartOfQuery += me.parens(
            me.getCriterionQuery(
              criterion.key,
              me.sanitizeQueryValue(val, criterion),
              (criterion.ignoreCase === true),
              (criterion.tokenized === true),
              supplementaryFindInfo,
              maxGroups,
              criterion
            ).trim()
          );
          return me.addOR(valuePartOfQuery, i, values.length);
        };

    me.logger.debug("Criterion", criterion);
    if (Array.isArray(criterion.value) && !criterion.value.length) {
      throw "SordProvider: " + criterion.key + ": it is not allowed to use empty arrays as a search value.";
    }
    criterionQuery = (Array.isArray(criterion.value) ? criterion.value : [criterion.value])
      .reduce(addCriterionQueriesForAllValuesToQuery, "");

    criterionQuery = Array.isArray(criterion.value) ? me.parens(criterionQuery) : criterionQuery;
    me.logger.debug("Generated query for criterion:", criterionQuery);
    return query += criterionQuery;
  },

  getSearchCriteriaQuery: function (searchCriteria, maxGroups, supplementaryFindInfo) {
    var me = this;
    me.logger.debug("Building query for search criteria");
    return searchCriteria.reduce(me.addCriterionToQuery.bind(me, maxGroups, supplementaryFindInfo), "");
  },

  parens: function (s) {
    return " (" + s + ") ";
  },

  buildRegEx: function (values) {
    return new RegExp(values.join("|"), "gi");
  },

  buildMasksQuery: function (masks) {
    var me = this;
    return masks.reduce(function (masksQuery, m, i) {
      return me.addOR(
        (masksQuery + me.parens(me.FIND_DIRECT.FIELD_MASK_NAME + ':"' + me.sanitizeQueryValue(m) + '"')),
        i,
        masks.length
      );
    }, "");
  },

  escapeOrRemoveInvalidCharacters: function (val, params) {
    var me = this,
        result = val,
        valueOrOtherwise = function (value, otherwise) {
          return typeof value == 'undefined' ? otherwise : value;
        },
        sanitizeParams = (params || {}).sanitize || {};

    sanitizeParams.escapeValues = valueOrOtherwise(sanitizeParams.escapeValues, true);
    sanitizeParams.blankValues = valueOrOtherwise(sanitizeParams.blankValues, true);
    sanitizeParams.removeDupWhiteSpaces = valueOrOtherwise(sanitizeParams.removeDupWhiteSpaces, true);

    if (sanitizeParams.escapeValues) {
      result = result.replace(me.escapeRegEx || (me.escapeRegEx = me.buildRegEx(me.ESCAPE_VALUES)), "\\$1");
    }
    if (sanitizeParams.blankValues) {
      result = result.replace(me.removeRegEx || (me.removeRegEx = me.buildRegEx(me.BLANK_VALUES)), " ");
    }
    if (sanitizeParams.removeDupWhiteSpaces) {
      // remove probably invalid double/tripple whitespaces
      result = result.replace(me.removeDupWhiteSpaces || (me.removeDupWhiteSpaces = /\s\s+/g), " ");
    }

    result = result.trim();

    return result;
  },

  sanitizeQueryValue: function (val, params) {
    var me = this;
    return me.escapeOrRemoveInvalidCharacters(val, params); //TODO: filterStopWords like in BS-Knowledge?
  },

  extendQueryByCustomQuery: function (query, custom) {
    var me = this;
    return me.parens(me.sanitizeQueryValue(custom)) + (query ? me.parens(query) : "");
  },

  extendQueryByWildCard: function (query) {
    var me = this;
    return me.parens(me.wildCard) + me.parens(query);
  },

  buildQuery: function (masks, searchCriteria, queryOpts) {
    var me = this, query = "", supplementaryFindInfo;

    me.logger.debug("Building search query");
    me.FIND_DIRECT = ixConnect.getCONST().FIND_DIRECT;

    if (!(masks.length === 1 && masks[0] === "")) {
      me.logger.debug("Including masks in query", masks);
      query += me.parens(me.buildMasksQuery(masks));
    }

    // this will be used to find all possible values of a criterion if a criterion's search value contains the wildcard
    (supplementaryFindInfo = me.getFindInfoForConstantSearchValues(masks, searchCriteria, queryOpts.maxGroups))
      && me.logger.debug("END: Built supplementary findInfo");

    query += me.getSearchCriteriaQuery(searchCriteria, queryOpts.maxGroups, supplementaryFindInfo);

    queryOpts.customQuery
      && (query = me.extendQueryByCustomQuery(query, queryOpts.customQuery));

    me.logger.debug("Built query", query);

    return query
      ? (queryOpts.customQuery ? query : me.extendQueryByWildCard(query))
      : me.wildCard;
  },

  buildFindDirect: function (masks, searchCriteria, queryOpts) {
    var me = this, findDirect = new FindDirect();
    me.logger.debug("Building findDirect");
    queryOpts || (queryOpts = {});
    findDirect.query = me.buildQuery(masks, searchCriteria, queryOpts).replace(/\s\s+/g, " ");
    findDirect.searchInIndex = true;
    if (queryOpts.customQuery) {
      findDirect.searchInMemo = true;
      findDirect.searchInFulltext = true;
      findDirect.searchInSordName = true;
    }
    return findDirect;
  },

  buildFindInfoForContextTerms: function (masks, searchCriteria, queryOpts) {
    var me = this, findInfo = new FindInfo();
    me.logger.debug("Building findInfo for search via mask(s)", masks);

    queryOpts || (queryOpts = {});
    sol.common.ObjectUtils.type(me.query, "string")
      && (queryOpts.customQuery = String(me.query));

    findInfo.findDirect = me.buildFindDirect(masks, searchCriteria, queryOpts);
    return findInfo;
  },

  getGroupingTerm: function (fuzzy) {
    if ((fuzzy.groupBy || {}).type !== "GRP") {
      throw "SordProvider: Fuzzy Type `" + fuzzy.groupBy.type + "` not implemented. Supported: GRP";
    }
    return (fuzzy.groupBy.tokenized === true ? "tLINE." : "LINE.") + fuzzy.groupBy.key;
  },

  getContextTerms: function (findInfo, groupingTerm, maxGroups) {
    var me = this;
    me.logger.debug(["Context search term `{0}`, max results `{1}`", groupingTerm, maxGroups]);
    return Array.prototype.slice.call(ixConnect.ix().getContextTerms(findInfo, groupingTerm, maxGroups));
  },

  castThenAddResults: function (acc, result) {
    acc[result.term] = +(result.docNum);
    return acc;
  },

  searchViaContextTerms: function (masks, searchCriteria, options) {
    var me = this, maxGroups = options.fuzzy.maxGroups;

    me.logger.debug("... context term search using search criteria", searchCriteria);
    return me.getContextTerms(
      me.buildFindInfoForContextTerms(masks, searchCriteria, { maxGroups: maxGroups }),
      me.getGroupingTerm(options.fuzzy),
      (+(maxGroups) || me.defaultMaxGroups)
    )
      .reduce(me.castThenAddResults, {});
  },

  performSearch: function (masks, searchCriteria, options) {
    var me = this;
    me.logger.debug("Starting search process using defined options");
    return (
      (options.fuzzy ? me.searchViaContextTerms : me.searchViaIndex).bind(me)
    )(masks, searchCriteria, options);
  },

  optimizationIdDefined: function (optimization) {
    return typeof optimization === "number";
  },

  pagingIdDefined: function (pagingId) {
    return typeof pagingId === "string";
  },

  initializeCaching: function (initOptimizationCache, instructions) {
    var me = this;
    if (initOptimizationCache) {
      me._initialOptimization = me.addInstructionsToCache("manual", instructions);
    }
  },

  addFilterDefinition: function (instructions, filter) {
    var me = this;
    if (!Array.isArray(filter)) {
      throw "SordProvider: filter must be an array of objects!";
    }

    filter.forEach(function (criterion) {
      if ((typeof criterion !== "object") || (typeof criterion.prop !== "string" && criterion.prop) || ((typeof criterion.value !== "string") && (!Array.isArray(criterion.value)))) {
        throw "SordProvider: filter criterion is no object, or prop or value not suited for filtering";
      }
      criterion.value = (typeof criterion.value === "string" ? me.stringToRegExp : me.arrayToRegExp)(criterion.value, me.wildCard);
    });

    instructions.filter = filter;
  },

  generateInstructions: function (output, filter, options) {
    var me = this, instructions;

    if (Array.isArray(output) && output.length > 0) {
      instructions = me.parseOutputDefinition(output);
      filter && me.addFilterDefinition(instructions, filter);
      // add filter to instructions
      me.logger.debug("Output options parsed. Generated optimized instructions:", instructions);
      me.initializeCaching((me.optimize === true), instructions);
    } else {
      if (output.formatter && output.config && !options.fuzzy) {
        instructions = {
          mbs: [], // used for generating a sordZ for CheckoutSord
          // defines, which values will be retrieved from the checked out sord
          targetProps: [], // used when sparse option is set
          converterConfig: { sordKeys: [], objKeys: [], mapKeys: {}, formBlobs: {} },
          directValues: {},
          dvKeys: [],
          objectFormatter: {
            formatter: output.formatter,
            config: output.config
          }
        };

        filter && me.addFilterDefinition(instructions, filter);
      } else if (!options.fuzzy) {
        throw "SordProvider: output parameter must be defined as an Array or as Object with parameter formatter and config to use ObjectFormatter";
      }
      me.logger.debug("Output schema will be produced by fuzzy search (getContextTerms)");
    }
    return instructions;
  },


  getInstructionsFromCache: function () {
    var me = this, instructions, optimizationId = me.optimize;
    if (me.optimizationIdDefined(optimizationId)) {
      instructions = me.getCachedInstructions("manual", optimizationId);
      me.logger.debug("Optimized Run: Using cached instructions instead of parsing output parameter");
    }
    return instructions;
  },

  initSearchAndProcessingInstructions: function (outputDefinition, filter, options, result) {
    var me = this, instructions;
    !(instructions = me.getInstructionsFromCache())
      && (instructions = me.generateInstructions(outputDefinition, filter, options))
      && me._initialOptimization // value has been set in generateInstructions, may be undefined if optimization is not active
      && (result.optimization = me._initialOptimization);

    options.paging // restrict pageSize to max allowed value
      && (options.pageSize > me.pageSizeMax)
      && (options.pageSize = me.pageSizeMax);

    options.idSordZ = (instructions.idName === "guid") ? SordC.mbOnlyGuid : SordC.mbOnlyId;

    me.formatAsTemplateSord = options.formatAsTemplateSord === true;
    me.ipn = options.ignorePropertyNames === true || (me.formatAsTemplateSord && options.ignorePropertyNames === undefined);

    return instructions;
  },

  /**
   * @return {Object} return
   * @return {String[]|Object[]} return.sords all found and formatted sords. String[] if `output` has only one property or Object[] otherwise
   * @return {Object} return.groups map of the group by field values and their result counts
   * @return {String} return.paging the searchId which can be again passed to this service as `options.paging` parameter to continue the search
   * @return {Number} return.optimization the optimizationId which can be again passed to this service as `optimize`
   */
  process: function () {
    var me = this, processingInstructions, deliverables, result = {},
        outputDefinition = me.output, options = (me.options || {}),
        filter = me.filter, fuzzySearch = !!options.fuzzy,
        pagingOpt = (options.paging || (options.paging = options.searchId));

    if (me.ids && me.id) {
      throw "SordProvider: you can only pass the `ids` or the `id` parameter, but not both at the same time.";
    }

    if ((options.endPaging === true)) {
      if (!me.pagingIdDefined(pagingOpt)) {
        throw "SordProvider: `endPaging:true` has been defined. However, no searchId was passed.";
      }
      me.closeFind(pagingOpt);
      return { sords: [] };
    }

    if (options.startPagingFrom !== undefined) {
      me.manualPagingFrom = options.startPagingFrom;
    }

    if (sol.common.ObjectUtils.type(options.query, "string")) {
      me.query = options.query;
    }

    if (options.findDirect || me.query) { // will use findDirect instead of findByIndex
      me.findDirect = true;
    }

    !fuzzySearch && // no preparations required for a fuzzy search
      (processingInstructions = me.initSearchAndProcessingInstructions(outputDefinition, filter, options, result));

    deliverables = (me.search || me.pagingIdDefined(pagingOpt))
      ? me.performSearch(me.masks, me.search, options) // findByIndex or getContextTerms (fuzzy) search
      : (me.id || me.ids); // use specified ids instead of searching

    if (fuzzySearch) { // only stores results. no processing for fuzzy search results
      me.logger.debug("Returning fuzzy search results (groups)");
      result.groups = deliverables;
    } else {
      result.sords = [];
      deliverables
        && (result.sords = me.processIds(deliverables, processingInstructions)) // apply output rules
        && deliverables.paging // if the search was paged and can be continued ...
        && (result.searchId = deliverables.paging); // ... store pagingId in result

      me.moreResults && (result.moreResults = true);

      if (result.sords && typeof result.sords[0] === "object") {
        processingInstructions.filter
          && (result.sords = me.filterSords(result.sords, processingInstructions.filter));

        options.sparse
          && me.removeEmptyFields(result.sords, processingInstructions.targetProps);

        Array.isArray(options.propsAsArrays)
          && me.propsToArrays(result.sords, options.propsAsArrays);
      }
    }

    return result;
  }
});


/**
 * This class contains util functions to facilitate working with the SordProvider.
 * E.g. run, which takes a configuration and returns processed sords.
 * runOptimized which takes a configuration, a cacheObject (this should be a persistent
 * object in your class) and a optimization name. Additionally to the processed sords,
 * an "optimization" id will be returned. This id will automatically get stored at
 * cacheObject[optimizationName].
 *
 * The passed config will be stringified and parsed to create a copy of it. This reduces
 * bugs. If you already pass a copied configuration into this function, you can disable
 * the copy mechanism by defining { copy: false } as the fourth parameter.
 * @elojc
 * @eloas
 * @eloix
 */
sol.define("sol.common.SordProviderUtils", {
  singleton: true,

  runOptimized: function (config, cacheObject, optimizationName, opts) {
    var me = this, result;
    opts || (opts = {});
    try {
      config = config ? (opts.copy === false ? config : JSON.parse(JSON.stringify(config))) : {};
    } catch (e) {
      throw "SordProviderUtils: configuration object could not be converted to JSON. Do not pass java objects/strings to SordProvider! " + e;
    }

    if (typeof cacheObject !== "object") {
      throw "SordProviderUtils: the second argument to runOptimized must be a persistent object. Optimization ids will be stored here.";
    }

    if (!optimizationName) {
      throw "SordProviderUtils: the third argument to runOptimized must be a unique string (name) for the optimization. The name will be used for referencing a stored optimization id.";
    }

    if (config.optimize = cacheObject[optimizationName]) { // exclude unnecessary properties from config
      config["output"] = undefined;
      config["filter"] = undefined;
    } else {
      config.optimize = true;
    }

    cacheObject[optimizationName] = (result = me.run(config, { copy: false })).optimization; // store optimization ID in cache
    return result;
  },

  run: function (config, opts) {
    opts || (opts = {});
    try {
      config = config ? (opts.copy === false ? config : JSON.parse(JSON.stringify(config))) : {};
    } catch (e) {
      throw "SordProviderUtils: configuration object could not be converted to JSON. Do not pass java objects/strings to SordProvider!" + e;
    }
    return (sol.create("sol.common.SordProvider", config)).process(config || {});
  },

  create: function (config) {
    return sol.create("sol.common.SordProviderBuilder", config || {});
  }

});

/**
 * This class is in experimental mode and is not allowed to used from external source.
 *
 * Only for internal purposes currently.
 * @experimental
 * @private
 */
sol.define("sol.common.SordProviderBuilder", {

  _DEFAULT_FORMATTER: "sol.common.ObjectFormatter.TemplateSord",

  initialize: function (config) {
    var me = this;
    me.ids = {};
    me.masks = [];
    me.search = {};
    me.filter = {}
    me.output = {};
    me.options = config.options || {};


    me.$super("sol.Base", "initialize", [config]);
    return me;
  },

  /**
   *
   * @param {*} masks
   * @returns
   */
  addMasks: function (masks) {
    var me = this;

    sol.common.ObjectUtils
      .toArray(masks)
      .filter(function (mask) {
        return sol.common.ObjectUtils.isString(mask);
      })
      .forEach(function (mask) {
        // add mask only if the mask not already exists.
        me.masks.indexOf(mask) == -1 && me.masks.push(mask);
      });

    return me;
  },

  useId: function (id) {
    var me = this;

    if (!sol.common.RepoUtils.isRepoId(id)) {
      throw Error("`id`=" + id + " is not a valid elo object identifier. See checkoutSord documentation");
    }

    me.ids[id] = true;
    return me;
  },

  useIds: function (ids) {
    var me = this;
    sol.common.ObjectUtils.toArray(ids)
      .forEach(function (id) {
        me.useId(id);
      });

    return me;
  },

  /**
   * @param type {String}
   */
  addSearchCriteria: function (key, values, type) {
    var me = this;

    if (!me.search[key]) {
      me.search[key] = {
        values: sol.common.ObjectUtils.toArray(values),
        type: type
      };
    } else {
      // already exist, append new values
      sol.common.ObjectUtils
        .toArray(values)
        .forEach(function (val) {
          me.search[key].values.push(val);
        });
    }
    return me;
  },

  addDateSearchCriteria: function (key, value) {
    var me = this;
    me.addSearchCriteria(key, value, "date");
    return me;
  },

  addDateRangeCriteria: function (key, start, end) {
    var me = this,
        rangeStr;

    rangeStr = (start || "") + "..." + (end || "");
    me.addSearchCriteria(key, rangeStr, "date");
    return me;
  },

   /**
   * @param type {String}
   */
    addFilterCriteria: function (prop, values) {
      var me = this;
  
      if (!me.filter[prop]) {
        me.filter[prop] = {
          values: sol.common.ObjectUtils.toArray(values)
        };
      } else {
        // already exist, append new values
        sol.common.ObjectUtils
          .toArray(values)
          .forEach(function (val) {
            me.filter[prop].values.push(val);
          });
      }
      return me;
    },
  

  addOutput: function (source, target) {
    var me = this, outputDef, outputIdentifier;

    if (!(source.type || source.key)) {
      throw Error("source must have structure of {type, key}");
    }

    outputIdentifier = source.type + source.key;

    if (!me.output[outputIdentifier]) {
      me.output[outputIdentifier] = { source: source, target: target };
    } else {
      outputDef = me.output[outputIdentifier];

      if (outputDef.target.prop !== target.prop) {
        // ignore output if it is the same...
        // If it is not equals we have two fields with different names
        // that should not be possible
        throw Error("Output definition already exists for " + JSON.stringify(source) + " `target.prop` may not be different here");
      }
    }

    return me;
  },

  addOutputs: function (outputs) {
    var me = this;
    (outputs || []).forEach(function (output) {
      me.addOutput(output.source, output.target);
    });
    return me;
  },

  get: function () {
    // hide internal date so we want to copy relevant config data
    var me = this, config = {};

    if (!sol.common.ObjectUtils.isEmpty(me.ids)) {
      config.ids = me.mapIds();
    } else {
      config.masks = me.masks;
      config.search = me.mapToSearchCriteria();
    }

    if (!sol.common.ObjectUtils.isEmpty(me.filter)) {
      config.filter = me.mapToFilterCriteria();
    }


    config.output = me.mapOutput();
    config.options = me.options;

    return config;
  },

  run: function (options) {
    var me = this;

    return (me.optimizationName && me.optimizationCache)
      ? sol.common.SordProviderUtils.runOptimized(me.get(), me.optimizationCache, me.optimizationName, options)
      : sol.common.SordProviderUtils.run(me.get(), options);
  },

  mapToSearchCriteria: function () {
    var me = this;
    return Object.keys(me.search)
      .map(function (key) {
        var searchCriteria = me.search[key],
            searchCriteriaObj = { key: key, value: searchCriteria.values };
        searchCriteria.type && (searchCriteriaObj.type = searchCriteria.type);
        return searchCriteriaObj;
      });
  },

  mapToFilterCriteria: function () {
    var me = this;
    if (!sol.common.ObjectUtils.isEmpty(me.filter)) {
      return Object.keys(me.filter)
        .map(function (key) {
          var filterCriteria = me.filter[key],
            filterCriteriaObj = { prop: key, value: filterCriteria.values };
          return filterCriteriaObj;
        });
    } else {
      return undefined;
    }
  },


  mapOutput: function () {
    var me = this;
    if (sol.common.ObjectUtils.isEmpty(me.output)) {
      return {
        formatter: me._DEFAULT_FORMATTER,
        config: {}
      };
    } else {
      return Object.keys(me.output)
        .map(function (key) {
          return me.output[key];
        });
    }
  },

  mapIds: function () {
    var me = this;
    return Object.keys(me.ids)
      .filter(function (id) {
        return !!me.ids[id];
      })
      .map(function (id) {
        return id;
      });
  }

});