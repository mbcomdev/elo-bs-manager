
//@include lib_Class.js

/**
 * This class provides basic functionality for repository operations.
 *
 * @author ELO Digital Office GmbH
 * 
 * @elojc
 * @eloas
 * @eloix
 *
 * @requires sol.common.Template
 * @requires sol.common.SordUtils
 * @requires sol.common.AsyncUtils
 * @requires sol.common.FileUtils
 * @requires sol.common.StringUtils
 * @requires sol.common.SordTypeUtils
 *
 */
sol.define("sol.common.RepoUtils", {
  singleton: true,

  bom: "\uFEFF", // ByteOrderMark (BOM);

  pilcrow: "\u00b6",

  /**
   * Checkout a Sord.
   * @param {String} objId Can be an objId, a GUID or an ARCPATH
   * @param {Object} params (optional)
   * @param {de.elo.ix.client.IXConnection} params.connection (optional) Index server connection
   * @param {de.elo.ix.client.SordZ} [params.sordZ=SordC.mbAllIndex] (optional)
   * @param {de.elo.ix.client.LockZ} [params.lockZ=LockC.NO] (optional)
   * @return {de.elo.ix.client.Sord}
   */
  getSord: function (objId, params) {
    var me = this,
        sordZ, lockZ, conn, sord;

    sordZ = (params && params.sordZ) ? params.sordZ : SordC.mbAllIndex;
    lockZ = (params && params.lockZ) ? params.lockZ : LockC.NO;
    params = params || {};
    conn = params.connection || ixConnect;
    sord = conn.ix().checkoutSord(objId + "", sordZ, lockZ);
    if (me.logger.debugEnabled) {
      me.logger.debug("getSord: sord.id=" + sord.id + ", sord.name=" + sord.name + ", conn.user.id=" + conn.loginResult.user.id +
        ", conn.user.name=" + conn.loginResult.user.name + ", conn.timeZone=" + conn.loginResult.clientInfo.timeZone);
    }
    return sord;
  },

  /**
   * Returns sords by object IDs
   * @param {Array} objIds Object IDs
   * @param {Object} config (optional)
   * @param {de.elo.ix.client.IXConnection} config.connection (optional) Index server connection
   * @param {de.elo.ix.client.SordZ} [config.sordZ=SordC.mbAllIndex] (optional)
   * @param {Boolean} config.keepOrder (optional) Keep the order of the Sords
   * @return {de.elo.ix.client.Sord[]} Sords
   */
  getSords: function (objIds, config) {
    var me = this,
        conn, sordZ, findInfo, findResult, idx, sords, i;
    me.logger.enter("getSords", arguments);

    if (!objIds) {
      throw "Object IDs are empty";
    }
    if (!sol.common.ObjectUtils.isArray(objIds)) {
      throw "Parameter 'objIds' must be an array";
    }

    config = config || {};
    conn = config.connection || ixConnect;

    sordZ = config.sordZ || SordC.mbAllIndex;

    findInfo = new FindInfo();
    findInfo.findByIndex = new FindByIndex();
    findInfo.findOptions = new FindOptions();
    findInfo.findOptions.objIds = objIds;

    idx = 0;
    findResult = conn.ix().findFirstSords(findInfo, 100, sordZ);

    sords = [];

    while (true) {
      for (i = 0; i < findResult.sords.length; i++) {
        sords.push(findResult.sords[i]);
      }
      if (!findResult.moreResults) {
        break;
      }
      idx += findResult.sords.length;
      findResult = conn.ix().findNextSords(findResult.searchId, idx, 100, sordZ);
    }
    conn.ix().findClose(findResult.searchId);

    if (config.keepOrder) {
      sords = me.sortSordsByObjIdArray(sords, objIds);
    }

    me.logger.exit("getSords", sords);
    return sords;
  },

  /**
   * Sorts an array of sords by another array of object IDs
   * @param {de.elo.ix.client.Sord[]} sords Sords
   * @param {Array} objIds Object IDs
   * @return {de.elo.ix.client.Sord[]} Sords
   */
  sortSordsByObjIdArray: function (sords, objIds) {
    var me = this,
        sordsObj, resultArr;
    me.logger.enter("sortSordsByObjIdArray", arguments);
    sordsObj = {};
    resultArr = [];

    if (!sords) {
      throw "Sords array is empty";
    }
    if (!objIds) {
      throw "Object ID array is empty";
    }
    sords.forEach(function (sord) {
      sordsObj[String(sord.id)] = sord;
    });
    objIds.forEach(function (objId) {
      var sord;
      sord = sordsObj[String(objId)];
      if (sord) {
        resultArr.push(sord);
      }
    });
    me.logger.exit("sortSordsByObjIdArray", resultArr);
    return resultArr;
  },

  /**
   * Creates a temp file from a repository document with it's element name as file name
   * and downloads the document
   * @param {String} objId Object ID of the repository document.
   * @return {java.io.File} Temporary file.
   */
  createTempFileWithSordName: function (objId) {
    var me = this,
        editInfo, docVersion, url, fileName, tempDir, tempFile;

    me.logger.enter("createTempFileWithSordName", objId);
    editInfo = ixConnect.ix().checkoutDoc(objId + "", null, EditInfoC.mbSordDoc, LockC.NO);
    docVersion = editInfo.document.docs[0];

    if (!docVersion) {
      me.logger.info(["Document version is emtpy: objId={0}", objId]);
      return;
    }

    url = docVersion.url;
    fileName = sol.common.FileUtils.sanitizeFilename(editInfo.sord.name) + "." + editInfo.document.docs[0].ext;
    tempDir = new File(java.lang.System.getProperty("java.io.tmpdir"), "ELO_" + java.lang.System.nanoTime());
    tempDir.mkdir();
    tempFile = new File(tempDir.canonicalPath, fileName);
    ixConnect.download(url, tempFile);

    tempFile.deleteOnExit();
    tempDir.deleteOnExit();

    me.logger.exit("createTempFileWithSordName", tempFile.canonicalPath + "");
    return tempFile;
  },

  /**
   * Finds the children of an element.
   * @param {String} objId
   * @param {Object} config
   * @param {Boolean} config.includeFolders
   * @param {Boolean} config.includeDocuments
   * @param {Boolean} [config.includeReferences=false] (optional)
   * @param {de.elo.ix.client.SordZ} [config.sordZ=SordC.mbAll] (optional) `SordC.mbOnlyId` and `SordC.mbOnlyGuid` are not working
   * @param {Boolean} [config.recursive=false] (optional) If true, subfolders will be included (use carefully)
   * @param {Number} [config.level=3] (optional) If subfolders are included, this restricts the search depth (`-1` for max. depth)
   * @param {String} [config.maskId] (optional) If set, find objects related to this mask ID or name
   * @param {String[]} [config.maskIds] (optional) If set, find objects related to these mask IDs or names
   * @param {de.elo.ix.client.FindOptions} config.findOptions (optional) If set, this `FindOptions` will be applied the the search
   * @param {Object} config.objKeysObj (optional) Find by values
   * @param {String} config.name (optional) Filters the result by the sord name (all elements containing `name`, for exact matches see `exactName`)
   * @param {String} config.ownerId (optional) Filters the result by the owner ID
   * @param {Boolean} [config.exactName=false] (optional) If this is `true`, only objects will be returned, where the name matches exactly `name`
   * @param {de.elo.ix.client.IXConnection} ixConn (optional) This will be used instead of `ìxConnect` (usfull when the search should run in a different user context)
   * @returns {de.elo.ix.client.Sord[]}
   */
  findChildren: function (objId, config, ixConn) {
    var me = this,
        children, findInfo, findChildren, findByType, findByIndex, includeReferences,
        sordZ, recursive, level, objKeys, key, idx, findResult, i;

    me.logger.enter("findChildren", arguments);

    config = config || {};

    children = [];
    findInfo = new FindInfo();
    findChildren = new FindChildren();
    findByType = new FindByType();
    findByIndex = new FindByIndex();
    includeReferences = config.includeReferences || false;
    sordZ = config.sordZ || SordC.mbAll;
    recursive = config.recursive || false;
    level = config.level || 3;
    objKeys = [];

    ixConn = ixConn || ixConnect;

    me.logger.debug(["findChildren: conn.user.name={0}", ixConn.loginResult.user.name]);

    findChildren.parentId = objId + "";
    findChildren.mainParent = !includeReferences;
    findChildren.endLevel = (recursive) ? level : 1;

    if (config.includeFolders != undefined) {
      findByType.typeStructures = config.includeFolders;
    }
    if (config.includeDocuments != undefined) {
      findByType.typeDocuments = config.includeDocuments;
    }

    if (config.maskId != undefined) {
      findByIndex.maskId = config.maskId;
    }

    if (config.maskIds != undefined) {
      findByIndex.maskIds = config.maskIds;
    }

    if (config.name !== undefined) {
      findByIndex.name = config.name;
      if (config.exactName === true) {
        findByIndex.exactName = true;
      }
    }
    if (config.objKeysObj) {
      for (key in config.objKeysObj) {
        if (config.objKeysObj.hasOwnProperty(key)) {
          objKeys.push(me.createObjKey("", key, config.objKeysObj[key]));
        }
      }
      findByIndex.objKeys = objKeys;
    }

    if (config.ownerId != undefined) {
      findByIndex.ownerId = config.ownerId;
    }

    findInfo.findChildren = findChildren;
    findInfo.findByIndex = findByIndex;

    if (config.includeFolders || config.includeDocuments) {
      findInfo.findByType = findByType;
    }
    if (config.findOptions != undefined) {
      findInfo.findOptions = config.findOptions;
    }

    try {
      idx = 0;
      findResult = ixConn.ix().findFirstSords(findInfo, 1000, sordZ);
      while (true) {
        for (i = 0; i < findResult.sords.length; i++) {
          children.push(findResult.sords[i]);
        }
        if (!findResult.moreResults) {
          break;
        }
        idx += findResult.sords.length;
        findResult = ixConn.ix().findNextSords(findResult.searchId, idx, 1000, sordZ);
      }
    } finally {
      if (findResult) {
        ixConn.ix().findClose(findResult.searchId);
      }
    }
    me.logger.exit("findChildren", children);
    return children;
  },

  /**
   * Returns the first child
   * @param {Object} config Config
   * @param {de.elo.ix.client.Sord} config.parentId Parent Sord ID
   * @param {Boolean} [config.includeDocuments=true] Include documents
   * @param {Boolean} [config.includeFolders=true] Include folders
   * @return {de.elo.ix.client.Sord} First child
   */
  getFirstChild: function (config) {
    var me = this,
        sords, firstChildDocSord;

    config = config || {};
    config.includeDocuments = (typeof config.includeDocuments == "undefined") ? true : config.includeDocuments;
    config.includeFolders = (typeof config.includeFolders == "undefined") ? true : config.includeFolders;

    if (!config.parentId) {
      throw "Parent ID is empty";
    }

    sords = me.findChildren(config.parentId, {
      includeDocuments: config.includeDocuments,
      includeFolders: config.includeFolders
    });

    if (!sords || (sords.length < 1)) {
      return null;
    }

    firstChildDocSord = sords[0];
    return firstChildDocSord;
  },

  /**
   * Finds sords
   * @param {Object} params Parameters
   * @param {Object} params.objKeysObj Map that contains key-value pairs or objects
   *     Example:
   *     {
   *       "objKeysObj": {
   *         "VISITOR_STATUS": "PR*"
   *         "SOL_TYPE": { value: '"VISITOR" OR "VISITOR_GROUP" OR "VISITOR_COMPANY" OR "LONG_TERM_BADGE"', oneTerm: false }
	 *       }
   *     }
   *     If `oneTerm`is true, then the value is treated as one whole string.
   * @param {String} params.maskId (optional) If set, find objects related to this mask ID or name
   * @param {String[]} params.maskIds (optional) If set, find objects related to these mask IDs or names
   * @param {de.elo.ix.client.SordZ} [params.sordZ=SordC.mbAll] (optional) `SordC.mbOnlyId` and `SordC.mbOnlyGuid` are not working
   * @param {de.elo.ix.client.IXConnection} params.ixConn (optional) This will be used instead of `ìxConnect` (usfull when the search should run in a different user context)
   * @returns {de.elo.ix.client.Sord[]}
   *
   */
  findSords: function (params) {
    var me = this,
        objKeys = [],
        sords = [],
        findInfo, sordZ, key, i, idx, findResult, ixConn, entry, value, oneTerm;

    me.logger.enter("findSords", params);

    params = params || {};

    ixConn = params.ixConn || ixConnect;

    sordZ = params.sordZ || SordC.mbAll;

    findInfo = new FindInfo();

    if (params.objKeysObj || params.maskId || params.maskIds) {
      findInfo.findByIndex = new FindByIndex();

      if (params.objKeysObj) {
        for (key in params.objKeysObj) {
          if (params.objKeysObj.hasOwnProperty(key)) {
            entry = params.objKeysObj[key];
            if (typeof entry === "object") {
              value = entry.value;
              oneTerm = entry.oneTerm;
            } else {
              value = entry + "";
              oneTerm = (value.trim().indexOf("\"") == 0);
            }

            if (oneTerm) {
              findInfo.findOptions = new FindOptions();
              // eslint-disable-next-line no-undef
              findInfo.findOptions.searchMode = SearchModeC.ONE_TERM;
            }
            objKeys.push(me.createObjKey("", key, value));
          }
        }
        findInfo.findByIndex.objKeys = objKeys;
      }

      if (params.maskId != undefined) {
        findInfo.findByIndex.maskId = params.maskId;
      }

      if (params.maskIds != undefined) {
        findInfo.findByIndex.maskIds = params.maskIds;
      }
    }

    try {
      idx = 0;
      findResult = ixConn.ix().findFirstSords(findInfo, 1000, sordZ);
      while (true) {
        for (i = 0; i < findResult.sords.length; i++) {
          sords.push(findResult.sords[i]);
        }
        if (!findResult.moreResults) {
          break;
        }
        idx += findResult.sords.length;
        findResult = ixConn.ix().findNextSords(findResult.searchId, idx, 1000, sordZ);
      }
    } finally {
      if (findResult) {
        ixConn.ix().findClose(findResult.searchId);
      }
    }
    me.logger.exit("findSords", sords);

    return sords;
  },

  /**
   * Builds a search value string for an OR search
   * @param {Array} values
   * @returns {String}
   */
  buildOrValuesSearchString: function (values) {
    if (!values) {
      return "";
    }
    if (values.length == 1) {
      return values[0];
    }
    return values.map(function (value) {
      return "\"" + value + "\"";
    }).join(" OR ");
  },

  /**
   * Downloads a document from the repository
   * @param {String} objId Object ID of the document
   * @param {Object} config Configuration
   * @param {String} config.dstDirPath (optional) Destination directory path. `config.fileName` must also be set.
   * @param {String} config.fileName (optional) File name
   * @param {String} config.extension (optional) Extention
   * @param {java.io.File} config.file (optional) Destination file
   * @param {Boolean} config.createUniqueFileName (optional) If true the filename will be extended by a number if necessary
   * @return {String} Path of the downloaded file
   */
  downloadToFile: function (objId, config) {
    var me = this,
        editInfo, uniqueFileNamePart, counter,
        file, url;
    me.logger.enter("downloadToFile", arguments);
    config = config || {};
    editInfo = ixConnect.ix().checkoutDoc(objId + "", null, EditInfoC.mbSordDoc, LockC.NO);
    uniqueFileNamePart = "";
    counter = 0;
    if (!editInfo.document.docs || (editInfo.document.docs.length == 0)) {
      me.logger.exit("downloadToFile");
      return;
    }
    url = editInfo.document.docs[0].url;
    config.extension = config.extension || editInfo.document.docs[0].ext;

    do {
      if (counter > 0) {
        uniqueFileNamePart = "_" + sol.common.StringUtils.padLeft(counter, 3);
      }
      if (config.dstDirPath) {
        config.fileName = config.fileName || sol.common.FileUtils.sanitizeFilename(editInfo.sord.name);
        config.filePath = config.dstDirPath + File.separator + config.fileName + uniqueFileNamePart + "." + config.extension;
      }
      file = config.file || new File(config.filePath);
      if (file.exists() && !config.createUniqueFileName) {
        throw "File already exists: " + file.absolutePath;
      }
      counter++;
    } while (file.exists());

    if (config.createDirs) {
      org.apache.commons.io.FileUtils.forceMkdir(file.parentFile);
    }
    ixConnect.download(url, file);
    me.logger.exit("downloadToFile", file.absolutePath + "");
    return file.absolutePath;
  },

  replacementChar: "\uFFFD", // Replacement char

  /**
   * Downloads the content of a repository document into a string
   * @param {String} objId Object ID of the document. If a document version should be loaded, this has to be null
   * @param {String} docId If a docId is supplied, the function will try to download the version only, if objId is null.
   * @param {Object} params (optional) Additional parameter
   * @param {Boolean} [params.preserveBOM=false] (optional) If `true`, the BOM will not be removed (if present)
   * @param {Array} param.charsets=[UTF-8] Charsets, e.g. ["UTF-8", "ISO-8859-1"]
   * @param {de.elo.ix.client.IXConnection} params.connection (optional) Index server connection
   * @return {String} Content as string.
   */
  downloadToString: function (objId, docId, params) {
    var me = this,
        bytes, content, i, charset;

    params = params || {};
    params.charsets = params.charsets || ["UTF-8"];

    me.logger.enter("downloadToString", arguments);

    bytes = me.downloadToByteArray(objId, docId, params);

    for (i = 0; i < params.charsets.length; i++) {
      charset = params.charsets[i];
      content = new java.lang.String(bytes, charset) + "";
      if ((i == params.charsets.length - 1) || (content.indexOf(me.replacementChar) < 0)) {
        break;
      }
    }

    if (params.preserveBOM === true) {
      me.logger.exit("downloadToString", content);
      return content;
    }
    me.logger.exit("downloadToString");
    content = content.replace(me.bom, "");

    return content;
  },

  /**
   * Downloads the content of a repository document into a base64 string
   * @param {String} objId Object ID of the document. If a document version should be loaded, this has to be null
   * @param {String} docId If a docId is supplied, the function will try to download the version only, if objId is null.
   * @return {String} Content as base64 string.
   */
  downloadToBase64String: function (objId, docId) {
    var me = this,
        bytes;
    me.logger.enter("downloadToBase64String", arguments);
    bytes = me.downloadToByteArray(objId, docId);
    me.logger.exit("downloadToBase64String");
    return String(Packages.org.apache.commons.codec.binary.Base64.encodeBase64String(bytes));
  },

  /**
   * Downloads the content of a repository document into a byte array
   * @param  {String} objId Object ID of the document. If a document version should be loaded, this has to be null
   * @param {String} docId If a docId is supplied, the function will try to download the version only, if objId is null.
   * @param {de.elo.ix.client.IXConnection} params (optional)
   * @param {de.elo.ix.client.IXConnection} params.connection (optional) Index server connection
   * @return {java.lang.Byte[]} Content as byte array.
   */
  downloadToByteArray: function (objId, docId, params) {
    var me = this,
        inputStream, bytes;

    params = params || {};

    inputStream = me.downloadToStream(objId, docId, params);
    bytes = Packages.org.apache.commons.io.IOUtils.toByteArray(inputStream);
    inputStream.close();
    return bytes;
  },

  /**
   * @private
   * @param {String} objId
   * @param {String} docId
   * @param {Object} params
   * @param {de.elo.ix.client.IXConnection} params.connection
   * @return {java.io.InputStream}
   */
  downloadToStream: function (objId, docId, params) {
    var me = this,
        url, conn, inputStream;

    params = params || {};
    conn = params.connection || ixConnect;

    url = me.getDownloadUrl(objId, docId, params);

    me.logger.debug(["downloadToStream: conn.user.name={0}", conn.loginResult.user.name]);

    inputStream = conn.download(url, 0, -1);

    return inputStream;
  },

  /**
   * @private
   * @param {String} objId
   * @param {String} docId
   * @param {Object} params
   * @param {de.elo.ix.client.IXConnection} params.connection
   * @return {String}
   */
  getDownloadUrl: function (objId, docId, params) {
    var me = this,
        editInfo, docs, conn, url;

    params = params || {};
    conn = params.connection || ixConnect;

    if (!objId && !docId) {
      throw "objId and docId are both empty";
    }

    me.logger.debug(["getDownloadUrl: conn.user.name={0}", conn.loginResult.user.name]);

    if (objId) {
      editInfo = conn.ix().checkoutDoc(objId + "", null, EditInfoC.mbSordDoc, LockC.NO);
    } else if (docId) {
      editInfo = conn.ix().checkoutDoc(null, docId + "", EditInfoC.mbDocument, LockC.NO);
    }
    docs = editInfo.document.docs;
    if (!docs || (docs.length == 0)) {
      throw "There are no documents";
    }
    url = String(docs[0].url);

    return url;
  },

  contentTypeExtensions: {
    bmp: "image/bmp",
    ico: "image/x-ico",
    jpg: "image/jpeg",
    png: "image/png"
  },

  /**
   * @private
   * @param {String} objId
   * @param {String} docId
   * @param {Object} config Configuration
   * @param {String} config.extension Extension
   * @return {java.io.InputStream}
   */
  downloadToFileData: function (objId, docId, config) {
    var me = this,
        inputStream, fileData;
    me.logger.enter("downloadToFileData", arguments);
    config = config || {};
    inputStream = me.downloadToStream(objId, docId);
    fileData = new FileData();
    fileData.contentType = me.contentTypeExtensions[config.extension] || "application/octet-stream";
    fileData.data = Packages.org.apache.commons.io.IOUtils.toByteArray(inputStream);
    inputStream.close();
    me.logger.exit("downloadToFileData");
    return fileData;
  },

  /**
   * Downloads the content of a small repository document into a string
   * @param {String} objId Object ID of the document. If a document version should be loaded, this has to be null
   * @param {String} docId If a docId is supplied, the function will try to download the version only, if objId is null.
   * @return {java.lang.String} Content as string.
   */
  downloadSmallContentToString: function (objId, docId) {
    var me = this,
        content = "",
        editInfo;

    me.logger.enter("downloadSmallContentToString", arguments);

    if (objId) {
      editInfo = ixConnect.ix().checkoutSord(objId, new EditInfoZ(0, new SordZ(SordC.mbSmallDocumentContent)), LockC.NO);
      if (editInfo.sord.docVersion) {

        // If the content is too large, then `fileData` is `null`.
        if (editInfo.sord.docVersion.fileData) {
          content = new java.lang.String(editInfo.sord.docVersion.fileData.data, "UTF-8");
        } else {
          content = me.downloadToString(objId);
        }
      } else {
        me.logger.warn(["downloadSmallContentToString: No document version: objId={0}, docId={1}", objId || "", docId || ""]);
      }
    } else {
      editInfo = ixConnect.ix().checkoutDoc(null, docId + "", EditInfoC.mbSordDocSmallContent, LockC.NO);
      content = new java.lang.String(editInfo.document.docs[0].fileData.data, "UTF-8");
    }

    content = content.replace(me.bom, "");
    me.logger.exit("downloadSmallContentToString");

    return content;
  },

  /**
   * Uploads the content of a small repository document
   * @param {String} objId Object ID of the document.
   * @param {String} content Content as string.
   * @param {Object} config Configuration
   * @param {de.elo.ix.client.IXConnection} config.connection Index server connection
   */
  uploadSmallContent: function (objId, content, config) {
    var me = this,
        conn, fileContent, editInfo, sordZ;

    me.logger.enter("uploadSmallContent", arguments);

    config = config || {};
    conn = config.connection || ixConnect;

    sordZ = new SordZ(SordC.mbSmallDocumentContent);

    fileContent = new java.lang.String(content);
    editInfo = conn.ix().checkoutSord(objId, new EditInfoZ(0, sordZ), LockC.NO);
    editInfo.document = new Packages.de.elo.ix.client.Document();
    editInfo.document.docs = [new DocVersion()];
    editInfo.document.docs[0].workVersion = true;
    editInfo.document.docs[0].ext = editInfo.sord.docVersion.ext;
    editInfo.document.docs[0].contentType = editInfo.sord.docVersion.contentType;
    editInfo.document.docs[0].fileData = new FileData();
    editInfo.document.docs[0].fileData.data = fileContent.getBytes(java.nio.charset.Charset.forName("UTF-8"));
    conn.ix().checkinDocEnd(editInfo.sord, sordZ, editInfo.document, LockC.NO);
    me.logger.exit("uploadSmallContent");
  },

  /**
   * Creates a new repository document or saves a new version to an existing document.
   * @param {Object} saveToRepoConfig
   * @param {String} saveToRepoConfig.name Name
   * @param {String} saveToRepoConfig.objId Object which should be updated (`parentId`, `repoPath` and `tryUpdate` are redundant in this case); objId will be used first
   * @param {String} saveToRepoConfig.parentId Parent folder object ID
   * @param {String} saveToRepoConfig.repoPath Complete destination repository path
   * @param {String} saveToRepoConfig.maskId Mask ID
   * @param {Object} saveToRepoConfig.objKeysObj Map that contains key-value pairs
   * @param {java.io.File} saveToRepoConfig.file File
   * @param {String} saveToRepoConfig.extension
   * @param {String} saveToRepoConfig.contentString String to save
   * @param {String} saveToRepoConfig.withoutBom Saves a string without BOM
   * @param {Object} saveToRepoConfig.contentObject Object to save
   * @param {java.io.OutputStream} saveToRepoConfig.outputStream Output stream to save
   * @param {String} saveToRepoConfig.base64Content Base64 encoded content to save
   * @param {Boolean} saveToRepoConfig.tryUpdate Inserts a new version if the object already exists
   * @param {String} saveToRepoConfig.version Version
   * @param {String|Number} saveToRepoConfig.versionIncrement Version increment, i.g. `1`
   * @param {String} saveToRepoConfig.versionComment Version comment
   * @param {String} saveToRepoConfig.ownerId Owner Id for a new version if the object already exists
   * @param {de.elo.ix.client.IXConnection} saveToRepoConfig.connection Index server connection
   * @param {Number} saveToRepoConfig.encryptionSet Encryption set
   * @return {String} Object ID
   */
  saveToRepo: function (saveToRepoConfig) {
    var me = this,
        parentRepoPath, bytes, inputStream, editInfo, objKeys, key, objId, conn,
        newVersionString = "",
        currentVersionString, encryptionSet;

    me.logger.enter("saveToRepo", arguments);

    conn = saveToRepoConfig.connection || ixConnect;

    if (saveToRepoConfig.repoPath) {
      saveToRepoConfig.name = me.getNameFromPath(saveToRepoConfig.repoPath);
      parentRepoPath = me.getParentPath(saveToRepoConfig.repoPath);
      saveToRepoConfig.parentId = me.getObjId(parentRepoPath);
    }

    saveToRepoConfig.objKeysObj = saveToRepoConfig.objKeysObj || {};

    saveToRepoConfig.maskId = saveToRepoConfig.maskId || "";

    if (saveToRepoConfig.objId || (saveToRepoConfig.tryUpdate && saveToRepoConfig.repoPath)) {
      try {
        objId = saveToRepoConfig.objId || me.getObjId(saveToRepoConfig.repoPath);
        if (objId) {
          editInfo = conn.ix().checkoutDoc(objId + "", null, EditInfoC.mbSordDoc, LockC.NO);
        }
      } catch (ignore) {
        // Object not found
      }
    }

    if (editInfo && !saveToRepoConfig.name) {
      saveToRepoConfig.name = editInfo.sord.name;
    }

    if (!editInfo) {
      editInfo = conn.ix().createDoc(saveToRepoConfig.parentId + "", saveToRepoConfig.maskId + "", null, EditInfoC.mbSordDocAtt);
      objKeys = Array.prototype.slice.call(editInfo.sord.objKeys);
      objKeys.push(me.createObjKey(DocMaskLineC.ID_FILENAME, DocMaskLineC.NAME_FILENAME, ""));
      editInfo.sord.objKeys = objKeys;

      if (saveToRepoConfig.ownerId) {
        editInfo.sord.ownerId = saveToRepoConfig.ownerId;
      }
    }

    if (saveToRepoConfig.base64Content) {
      bytes = Packages.org.apache.commons.codec.binary.Base64.decodeBase64(saveToRepoConfig.base64Content);
    }

    if (saveToRepoConfig.outputStream) {
      bytes = saveToRepoConfig.outputStream.toByteArray();
      saveToRepoConfig.outputStream.close();
    }

    if (saveToRepoConfig.contentObject) {
      saveToRepoConfig.contentString = JSON.stringify(saveToRepoConfig.contentObject, null, 2);
      saveToRepoConfig.extension = saveToRepoConfig.extension || "json";
    }

    if (saveToRepoConfig.contentString) {
      if (!saveToRepoConfig.withoutBom) {
        saveToRepoConfig.contentString = me.bom + saveToRepoConfig.contentString;
      }
      bytes = new java.lang.String(saveToRepoConfig.contentString).getBytes("UTF-8");
    }

    if (saveToRepoConfig.file) {
      saveToRepoConfig.fileName = saveToRepoConfig.file.name;
      if (!saveToRepoConfig.name) {
        saveToRepoConfig.name = Packages.org.apache.commons.io.FilenameUtils.removeExtension(saveToRepoConfig.file.name);
      }
      if (!saveToRepoConfig.extension) {
        saveToRepoConfig.extension = Packages.org.apache.commons.io.FilenameUtils.getExtension(saveToRepoConfig.file.absolutePath);
      }
    } else if (bytes) {
      saveToRepoConfig.fileName = saveToRepoConfig.name + "." + saveToRepoConfig.extension;
      if (sol.common.FileUtils) { // check to avoid errors in older solution versions without proper include
        saveToRepoConfig.fileName = sol.common.FileUtils.sanitizeFilename(saveToRepoConfig.fileName);
      } else {
        me.logger.debug(["Could not sanitize file name ('{0}'): missing include of 'sol.common.FileUtils'", saveToRepoConfig.fileName]);
      }
    }
    editInfo.sord.name = saveToRepoConfig.name;

    for (key in saveToRepoConfig.objKeysObj) {
      if (saveToRepoConfig.objKeysObj.hasOwnProperty(key) && key) {
        sol.common.SordUtils.setObjKeyValue(editInfo.sord, key, saveToRepoConfig.objKeysObj[key]);
      }
    }

    if (saveToRepoConfig.fileName) {
      sol.common.SordUtils.setObjKeyValue(editInfo.sord, DocMaskLineC.NAME_FILENAME, saveToRepoConfig.fileName);
    }

    saveToRepoConfig.versionIncrement = saveToRepoConfig.versionIncrement || 1;
    if (saveToRepoConfig.versionIncrement && editInfo.document.docs && (editInfo.document.docs.length > 0)) {
      currentVersionString = editInfo.document.docs[0].version + "";
    } else {
      newVersionString = (saveToRepoConfig.versionIncrement || "") + "";
    }

    editInfo.document.docs = [new DocVersion()];

    if (saveToRepoConfig.versionIncrement) {
      if (currentVersionString) {
        try {
          newVersionString = me.calcNextVersion(objId, saveToRepoConfig.versionIncrement);
        } catch (ignore) {}
      }
    }

    if (saveToRepoConfig.version) {
      newVersionString = saveToRepoConfig.version;
    }

    if (newVersionString) {
      editInfo.document.docs[0].version = newVersionString;
    }

    if (saveToRepoConfig.versionComment) {
      editInfo.document.docs[0].comment = saveToRepoConfig.versionComment;
    }

    if (saveToRepoConfig.ownerId) {
      editInfo.document.docs[0].ownerId = saveToRepoConfig.ownerId;
    }

    editInfo.document.docs[0].ext = saveToRepoConfig.extension;
    editInfo.document.docs[0].pathId = editInfo.sord.path;

    encryptionSet = (typeof saveToRepoConfig.encryptionSet != "undefined") ? saveToRepoConfig.encryptionSet : editInfo.sord.details.encryptionSet;
    editInfo.sord.details.encryptionSet = encryptionSet;
    editInfo.document.docs[0].encryptionSet = encryptionSet;

    editInfo.document = conn.ix().checkinDocBegin(editInfo.document);

    if (saveToRepoConfig.file) {
      editInfo.document.docs[0].uploadResult = conn.upload(editInfo.document.docs[0].url, saveToRepoConfig.file);
    } else if (bytes) {
      inputStream = new java.io.ByteArrayInputStream(bytes);
      editInfo.document.docs[0].uploadResult = conn.upload(editInfo.document.docs[0].url, inputStream, bytes.length, "application/octet-stream");
      inputStream.close();
    } else {
      throw "Input data is missing.";
    }

    editInfo.document = conn.ix().checkinDocEnd(editInfo.sord, SordC.mbAll, editInfo.document, LockC.NO);
    objId = editInfo.document.objId;

    me.logger.debug("Document saved to repository: objId=" + objId);
    me.logger.exit("saveToRepo");
    return String(objId);
  },

  /**
   * @private
   * Creates an ObjKey object
   * @param {String} id ID of the ObjKey
   * @param {String} name Name of the ObjKey
   * @param {String} value
   * @return {de.elo.ix.client.ObjKey} Created ObjKey
   */
  createObjKey: function (id, name, value) {
    var objKey = new ObjKey();
    if (id) {
      objKey.id = id;
    }
    objKey.name = name;
    objKey.data = [value];
    return objKey;
  },

  /**
   * Exports a repository folder into an ELO ZIP file
   * @param {java.io.File} exportZipFile ZIP file
   * @param {Object} exportOptions Export options, see de.elo.ix.client.ExportExtOptions
   */
  exportRepoData: function (exportZipFile, exportOptions) {
    var me = this,
        exportExtOptions, prop, exportId, exportZipUrl;

    me.logger.enter("exportRepoData", arguments);

    if (!exportZipFile) {
      throw "'exportZipFile' is missing";
    }

    if (!exportOptions) {
      throw "Export options are missing.";
    }

    if (exportOptions.srcList) {
      exportOptions.srcList.forEach(function (objId) {
        ixConnect.ix().checkoutSord(objId, SordC.mbOnlyId, LockC.NO);
      });
    }
    exportExtOptions = new ExportExtOptions();
    for (prop in exportOptions) {
      if (exportOptions.hasOwnProperty(prop)) {
        exportExtOptions[prop] = exportOptions[prop];
      }
    }

    exportId = ixConnect.ix().startExportExt(exportExtOptions);
    sol.common.AsyncUtils.waitForJob(exportId);
    exportZipUrl = ixConnect.ix().getExportZipUrl(exportId);
    ixConnect.download(exportZipUrl, exportZipFile);
    ixConnect.ix().finishExport(exportId);
    me.logger.exit("exportRepoData");
  },

  /**
   * Imports a ELO ZIP file into the repository
   * @param {java.io.File} importZipFile
   * @param {String} dstRepoPath Destination repository path
   * @param {Number} guidMethod GUID method, see de.elo.ix.client.ImportOptionsC
   * @param {Number} options Import options, see de.elo.ix.client.ImportOptionsC
   */
  importRepoData: function (importZipFile, dstRepoPath, guidMethod, options) {
    var me = this,
        importId, importZipUrl, dstObjId;
    me.logger.enter("importRepoData", arguments);
    if (typeof guidMethod === "undefined") {
      guidMethod = ImportOptionsC.GUIDS_KEEP;
    }
    if (typeof options === "undefined") {
      options = 0;
    }
    if (dstRepoPath) {
      dstObjId = me.preparePath(dstRepoPath);
    } else {
      options |= ImportOptionsC.USE_EXPORTED_PATH;
    }
    importId = ixConnect.ix().startImport(dstObjId + "", guidMethod, options);
    importZipUrl = ixConnect.ix().getImportZipUrl(importId);
    ixConnect.upload(importZipUrl, importZipFile);
    sol.common.AsyncUtils.waitForJob(importId);
    me.logger.exit("importRepoData");
  },

  /**
   * Returns the object ID of a given repository path
   * @param {String} path Repository path. The path separator is defined by the first character or the first charcter after "ARCPATH:"
   * @param {Object} params Parameters
   * @param {Boolean} params.resolveGuid Resolve GUID
   * @return {String} The ID of the new element, or null if it does not exist
   */
  getObjId: function (path, params) {
    var me = this,
        conn, sord, objId;

    params = params || {};
    me.logger.enter("getObjId", { path: path, params: params });

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;

    if (me.isObjId(path)) {
      me.logger.exit("getObjId", { objId: path });
      return path;
    }

    if (me.isGuid(path)) {
      if (params.resolveGuid) {
        try {
          sord = conn.ix().checkoutSord(path + "", SordC.mbOnlyId, LockC.NO);
          objId = sord.id + "";
          me.logger.exit("getObjId", { objId: objId });
          return objId;
        } catch (ex) {
          me.logger.warn(["Can't find GUID: guid={0}", path]);
          return;
        }
      } else {
        me.logger.exit("getObjId", { guid: path });
        return path;
      }
    }

    path = me.normalizePath(path, true);

    try {
      sord = conn.ix().checkoutSord(path + "", SordC.mbOnlyId, LockC.NO);
      objId = sord.id + "";
      me.logger.exit("getObjId", { objId: objId });
      return objId;
    } catch (ignore) {
      // Object not found
    }

    me.logger.exit("getObjId");
  },

  /**
   * Returns the object GUID of a given Object ID
   * @param {String} objId Object ID
   * @return {String} GUID
   */
  getGuid: function (objId) {
    var me = this,
        conn, sord;
    me.logger.enter("getGuid", arguments);
    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;
    try {
      sord = conn.ix().checkoutSord(objId, SordC.mbOnlyGuid, LockC.NO);
      me.logger.exit("getGuid", sord.guid);
      return sord.guid;
    } catch (ignore) {
      // Object not found
    }
    me.logger.exit("getGuid");
  },


  /**
   * Checks wether a path exists
   * @param {String} repoPath Repository path
   * @return {Boolean}
   */
  exists: function (repoPath) {
    var me = this;
    return !!me.getObjId(repoPath);
  },

  /**
   * Returns true if the given string is an object ID
   * @param {String} str Input string
   * @return {Boolean}
   */
  isObjId: function (str) {
    return /^[\d]{1,20}$/.test(String(str));
  },

  /**
   * Returns true if the given string is an object ID
   * @param {String} str Input string
   * @return {Boolean}
   */
  isGuid: function (str) {
    return /^\(\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\)$/.test(String(str));
  },

  /**
   * Returns true if the given string is an arcpath
   * @param {String} str Input string
   * @return {Boolean}
   */
  isArcpath: function (str) {
    return (str || "").indexOf("ARCPATH") === 0;
  },

  /**
   * Returns true if the given string is an okay path
   * @param {String} str Input string
   * @return {Boolean}
   */
  isOkeyPath: function (str) {
    return (str || "").indexOf("OKEY") === 0;
  },

  /**
   * Returns true if the given string is an md5 hash path
   * @param (String) str Input string
   * @returns {Boolean}
   */
  isMd5HashPath: function (str) {
    return (str || "").indexOf("MD5") === 0;
  },

  isLMatchPath: function (str) {
    return (str || "").indexOf("LMATCH") === 0;
  },

  /**
   * Returns true if str is a possible elo object identifier.
   *
   * Check `checkoutSord` documentation to see all valid object identifiers
   *
   * @param {String} str Input string
   * @return {Boolean}
   */
  isRepoId: function (str) {
    var me = this;
    return me.isObjId(str)
      || me.isGuid(str)
      || me.isArcpath(str)
      || me.isOkeyPath(str)
      || me.isMd5HashPath(str)
      || me.isLMatchPath(str);
  },

  /**
   * Looks up an objId by an index field value.
   *
   *     sol.common.RepoUtils.getObjIdByIndex( { mask: "Invoice", objKeyData: [ { key: "INVOICE_ID", value: "12345" } ] } );
   *
   * @param {Object} filter
   * @param {String} filter.mask (optional) Additional limit search by mask
   * @param {Object[]} filter.objKeyData Objects with key and value for the lookup
   * @returns {String} The objId
   * @throws Throws an exception, if result is not unique
   * @throws Throws an exception, if there is no result
   */
  getObjIdByIndex: function (filter) {
    var me = this,
        findInfo, objKeys,
        findResult, ids, _result, i, sord;
    me.logger.enter("getObjIdByIndex", arguments);
    findInfo = new FindInfo();
    objKeys = [];

    if (!filter || !filter.objKeyData || !Array.isArray(filter.objKeyData)) {
      throw "illegal filter: 'objKeyData' cannot be undefined and has to be an Array ";
    }

    filter.objKeyData.forEach(function (data) {
      if (data.key && data.value) {
        objKeys.push(me.createObjKey(null, data.key, data.value));
      }
    });

    findInfo.findByIndex = new FindByIndex();
    findInfo.findByIndex.objKeys = objKeys;

    if (filter.mask) {
      findInfo.findByIndex.maskId = filter.mask;
    }

    findResult = ixConnect.ix().findFirstSords(findInfo, 2, SordC.mbOnlyId);
    if (findResult.ids) { // Expected result when searching with SordC.mbOnlyId
      ids = findResult.ids;
    } else if (findResult.sords) { // in some cases the results will be returned this way, regardless of the SordC.mbOnlyId selector
      ids = [];
      for (i = 0; i < findResult.sords.length; i++) {
        sord = findResult.sords[i];
        ids.push(sord.id);
      }
    }
    if (!ids || ids.length <= 0) {
      throw "no element found";
    }
    if (ids.length > 1) {
      throw "no unique result";
    }
    _result = ids[0];
    me.logger.exit("getObjIdByIndex", _result);
    return _result;
  },

  /**
   * Returns the object ID of an object which is defined by a start object and an additional relative path
   *
   *    var objId = sol.common.RepoUtils.getObjIdFromRelativePath(123, "/.eloinst");
   *    var objId = sol.common.RepoUtils.getObjIdFromath("ARCPATH:/Administration", "/common/Configuration");
   *
   * If the start folder is adynamic register, this method handels the request a little different:
   *
   * - it determines all children
   * - it searches for a child element with the name specified by 'ath'
   * - unlike the same call on a normal folder, this does not support nested paths (i.e. `ath` can just have one level)
   *
   * @param {String} startFolderId
   * @param {String} relativePath Should start with a separator
   * @returns {String}
   */
  getObjIdFromRelativePath: function (startFolderId, relativePath) {
    var me = this,
        startObjId, startSord, children, objId, _result;

    me.logger.enter("getObjIdFromRelativePath", arguments);

    if (!startFolderId) {
      throw "Start folder ID is empty";
    }

    startObjId = me.getObjId(startFolderId);

    if (!relativePath) {
      return startObjId;
    }

    startSord = ixConnect.ix().checkoutSord(startObjId, SordC.mbAllIndex, LockC.NO);

    if (sol.common.SordUtils.isDynamicFolder(startSord)) {
      relativePath = relativePath.substring(1, relativePath.length);
      children = me.findChildren(startSord.id, {
        includeFolders: true,
        includeDocuments: true,
        includeReferences: true
      });
      children.some(function (child) {
        if (child.name == relativePath) {
          objId = child.id;
          return true;
        }
      });
      me.logger.exit("getObjIdFromRelativePath", objId);
      return objId;
    } else {
      _result = ixConnect.ix().checkoutSord("ARCPATH[" + startSord.id + "]:" + relativePath, SordC.mbOnlyId, LockC.NO).id;
      me.logger.exit("getObjIdFromRelativePath", _result);
      return _result;
    }
  },

  /**
   * Returns the object ID of an object which is defined by a relative solution path.
   * Searches in the folders which are defined in /common/Configuration/base.config in baseMergePaths.
   * Starts searching from behind.
   *
   * @param {String} relativePath
   * @returns {String}
   */
  getObjIdFromRelativeSolutionPath: function (relativePath) {
    var me = this,
        commonBaseConfig, baseMergePaths, i;

    commonBaseConfig = sol.create("sol.common.Config", { compose: "/common/Configuration/base.config" }).config;

    baseMergePaths = sol.common.ObjectUtils.clone(commonBaseConfig.baseMergePaths).reverse(); //we have to reverse the array to start searching in the custom part

    for (i = 0; i < baseMergePaths.length; i++) {
      try {
        return me.getObjIdFromRelativePath("ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/" + baseMergePaths[i], relativePath);
      } catch (e) {
        //ignore
      }
    }
  },

  /**
   * Returns repository path of a Sord object
   * @param {de.elo.ix.client.Sord} sord
   * @param {Boolean} withPrefix If true the ARCPATH: prefix will be added.
   * @param {Object} config (optional)
   * @param {String} [config.separator="/"] (optional)
   * @return {String} Repository path
   */
  getPath: function (sord, withPrefix, config) {
    var me = this,
        repoPathParts = [],
        separator, prefix, i, idNames, _result;
    me.logger.enter("getPath", arguments);
    if (!sord || !sord.refPaths || !sord.refPaths[0]) {
      me.logger.exit("getPath", "");
      return "";
    }

    idNames = sord.refPaths[0].path;
    for (i = 0; i < idNames.length; i++) {
      repoPathParts.push(idNames[i].name + "");
    }
    repoPathParts.push(sord.name + "");
    prefix = withPrefix ? "ARCPATH:" : "";
    separator = (config && config.separator) ? config.separator : "/";
    _result = prefix + separator + repoPathParts.join(separator);
    me.logger.exit("getPath", _result);
    return _result;
  },

  /**
   * Returns repository path of an object ID
   * @param {String} objId Object ID
   * @param {Object} config (optional)
   * @param {String} [config.separator="/"] (optional)
   * @return {String} Repository path
   */
  getPathFromObjId: function (objId, config) {
    var me = this,
        conn, sord, path;

    me.logger.enter("getPathFromObjId", arguments);

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;

    try {
      sord = conn.ix().checkoutSord(objId, new SordZ(SordC.mbRefPaths), LockC.NO);
    } catch (ignore) {
      //ignore
    }
    if (sord) {
      path = me.getPath(sord, false, config);
      me.logger.exit("getPathFromObjId", path);
      return path;
    }
    me.logger.exit("getPathFromObjId", "");
    return "";
  },

  /**
   * Checks and creates a repository path.
   *
   * The `repoPath` can be in handlebars [handlebars](http://handlebarsjs.com/) syntax and is applied via {@link sol.common.Template}.
   *
   * @param {String} repoPath Repository path. The path separator is defined by the first character or the first charcter after "ARCPATH:"
   * @param {Object} params (optional)
   * @param {String} params.mask (optional) If set, newly created parts of the path get that mask
   * @param {Boolean} params.returnDetails (optional) If set, the created objId will be returned as an object property. If the path already existed, an additional property existed:true will be returned.
   * @param {Boolean} params.skipIfNotExists (optional) If set and the repoPath does not exist, it will not be created. { objId: null, existed: false, skipped: true } will be returned.
   * @param {Object|de.elo.ix.client.Sord} params.data (optional) If set, this is applied to the repoPath, while the repoPath has to be in `handlebars` syntax
   * @param {String|Number} params.sordType (optional) Name or ID of a sord type which will be set on all new elements
   * @return {String|Object} The ID of the new element, or null if something went wrong
   */
  preparePath: function (repoPath, params) {
    var me = this,
        objId, _result,
        returnDetails = !!((params && params.returnDetails === true)),
        skipIfNotExists = !!(params && (params.skipIfNotExists === true));
    me.logger.enter("preparePath", arguments);

    if (params && params.data) {
      if (params.data instanceof Sord) {
        params.data = sol.common.SordUtils.getTemplateSord(params.data);
      }
      repoPath = sol.create("sol.common.Template", { source: repoPath }).apply(params.data);
    }

    objId = me.getObjId(repoPath);

    if (objId) {
      _result = { objId: objId, existed: true };
    } else if (skipIfNotExists) {
      me.logger.info("skipped", objId);
      _result = { objId: null, existed: false, skipped: true };
    } else {
      _result = { objId: me.createPath(repoPath, params), existed: false };
    }

    if (!returnDetails) {
      _result = _result.objId;
    } else {
      _result.path = repoPath;
    }

    me.logger.exit("preparePath", _result);

    return _result;
  },

  /**
   * Checks wether the repository path contains an empty path part
   * @private
   * @param {String} repoPath Repository path
   * @throws {Exception}
   */
  checkRepoPath: function (repoPath) {
    var me = this,
        separator, illegalString;

    if (!repoPath) {
      throw "Repository path is empty";
    }

    separator = me.getPathSeparator(repoPath);
    illegalString = separator + separator;
    if (repoPath.indexOf(illegalString) > -1) {
      throw "Repository path must not contain an empty path part: " + repoPath;
    }
  },

  /**
   * Creates a repository path.
   *
   * If the path contains dynamic content, use {@link #preparePath} instead.
   *
   * @param {String} repoPath A path. The path separator is defined by the first character or the first character after "ARCPATH:"
   * @param {Object} params (optional)
   * @param {String} params.mask (optional) If set, newly created parts of the path get that mask
   * @param {Object} params.rightsConfig Rights configuration
   * @param {String|Number} params.sordType Name or ID of a sord type which will be set on all new elements
   * @return {String} The ID of the new element, or null if something went wrong
   */
  createPath: function (repoPath, params) {
    var me = this,
        delim, sordNames, sords, ids, parentIdMatch, parentId, aclItemInherit, aclItems, fixedSordType, dynSordType,
        accessCode, userAcls, conn;
    me.logger.enter("createPath", arguments);
    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;
    params = params || {};
    parentIdMatch = repoPath.match(/^ARCPATH\[([^\]]+)\]/);
    parentId = parentIdMatch ? parentIdMatch[1] : "1";
    repoPath = me.normalizePath(repoPath);
    delim = me.getPathSeparator(repoPath);
    me.checkRepoPath(repoPath);
    sordNames = repoPath.substring(1).split(delim);
    sords = [];

    params.mask = params.mask || "";

    aclItemInherit = new AclItem();
    aclItemInherit.type = AclItemC.TYPE_INHERIT;
    aclItems = [aclItemInherit];

    if (params.rightsConfig && params.rightsConfig.users) {
      if (params.rightsConfig.rights) {
        accessCode = sol.common.AclUtils.createAccessCode(params.rightsConfig.rights);
      }
      if ((params.rightsConfig.mode == "SET") || (params.rightsConfig.mode == "REPLACE")) {
        aclItems = [];
      }
      userAcls = sol.common.AclUtils.retrieveUserAcl(params.rightsConfig.users, accessCode);
      if (userAcls) {
        userAcls.forEach(function (userAcl) {
          aclItems.push(userAcl);
        });
      }
    }

    try {
      fixedSordType = (params && params.sordType) ? ((typeof params.sordType !== "number") ? sol.common.SordTypeUtils.getSordTypeId(params.sordType) : params.sordType) : null;
      sordNames.forEach(function (name) {
        var sord = conn.ix().createSord(parentId + "", params.mask, SordC.mbAll);
        dynSordType = (!dynSordType) ? ((sord.type <= 6) ? sord.type : 6) : ((dynSordType <= 6) ? dynSordType : 6);
        sord.name = name;
        sord.aclItems = aclItems;
        sord.type = fixedSordType || dynSordType;
        sords.push(sord);
        dynSordType++;
      });

      ids = conn.ix().checkinSordPath(parentId + "", sords, SordC.mbAll);
      me.logger.exit("createPath", ids[ids.length - 1]);
      return ids[ids.length - 1];

    } catch (e) {
      this.logger.error("error creating archive path", e);
    }
    me.logger.exit("createPath", null);
    return null;
  },

  /**
   * Returns the repository path separator character
   * @param {String} repoPath Repository path
   * @return {String} Repository path separator
   */
  getPathSeparator: function (repoPath) {
    var me = this,
        matches, _result;
    me.logger.enter("getPathSeparator", arguments);
    repoPath = me.normalizePath(repoPath);
    if (repoPath && (repoPath.length > 0)) {
      if (repoPath.indexOf("{") == 0) {
        matches = repoPath.match("(?:{+)(?:[^}]+)(?:}+)(.)");
        if (matches && (matches.length == 2)) {
          me.logger.exit("getPathSeparator", matches[1]);
          return matches[1];
        }
      } else {
        _result = String(repoPath).substring(0, 1);
        me.logger.exit("getPathSeparator", _result);
        return _result;
      }
    }
    me.logger.exit("getPathSeparator", "/");
    return "/";
  },

  /**
   * Changes the path separator
   * @param {String} path Repository path
   * @param {String} newSeparator New separator
   * @return {String} Repository path that contains the new separator
   */
  changePathSeparator: function (path, newSeparator) {
    var me = this,
        separator, _result;
    me.logger.enter("changePathSeparator", arguments);
    path = String(path);
    separator = me.getPathSeparator(path);
    newSeparator = newSeparator || me.pilcrow;
    _result = sol.common.StringUtils.replaceAll(path, separator, newSeparator);
    me.logger.exit("changePathSeparator", _result);
    return _result;
  },

  /**
   * Returns the name part of a repository path
   * @param {String} repoPath Repository path
   * @return {String} Name part of the repository path
   */
  getNameFromPath: function (repoPath) {
    var me = this,
        separator, _result;
    me.logger.enter("getNameFromPath", arguments);
    repoPath = me.normalizePath(repoPath);
    separator = me.getPathSeparator(repoPath);
    _result = String(repoPath).split(separator).pop();
    me.logger.exit("getNameFromPath", _result);
    return _result;
  },

  /**
   * Returns the parent repository path
   * @param {String} repoPath Repository path
   * @return {String} Repository path of the parent folder
   */
  getParentPath: function (repoPath) {
    var me = this,
        separator, _result;
    me.logger.enter("getParentPath", arguments);
    separator = me.getPathSeparator(repoPath);
    _result = String(repoPath).substring(0, repoPath.lastIndexOf(separator));
    me.logger.exit("getParentPath", _result);
    return _result;
  },

  /**
   * Normalizes a repository path
   * @param {String} repoPath Repository path
   * @param {Boolean} withPrefix If true the ARCPATH: prefix will be added.
   * @return {String} Normalized repository path
   */
  normalizePath: function (repoPath, withPrefix) {
    repoPath = String(repoPath);
    if (repoPath.indexOf("ARCPATH") == 0) {
      if (withPrefix) {
        return repoPath;
      } else {
        return repoPath.replace(/^ARCPATH[^:]*:/, "");
      }
    } else {
      if (withPrefix) {
        return "ARCPATH:" + repoPath;
      } else {
        return repoPath;
      }
    }
  },

  /**
   * Deletes all references
   * @param {de.elo.ix.client.Sord} sord
   * @return {Array} Reference parent IDs
   */
  deleteAllReferences: function (sord) {
    var me = this,
        i, refPath, objId, refParentId,
        refParentIds = [],
        deleteOptions;

    if (!sord) {
      throw "Sord is empty";
    }
    if (!sord.refPaths) {
      throw "Reference paths are empty";
    }
    if (sord.refPaths.length <= 1) {
      return;
    }

    deleteOptions = new DeleteOptions();

    for (i = 1; i < sord.refPaths.length; i++) {
      refPath = sord.refPaths[i];
      if (refPath.path.length > 0) {
        refParentId = String(refPath.path[refPath.path.length - 1].id);
      } else {
        refParentId = "1";
      }
      refParentIds.push(refParentId);
      objId = sord.id + "";
      try {
        ixConnect.ix().deleteSord(refParentId, objId, LockC.NO, deleteOptions);
      } catch (ex) {
        me.logger.warn(["Cannot delete reference: refParentId={0}, objId={1}", refParentId, objId]);
      }
    }

    return refParentIds;
  },

  /**
   * Deletes a sord
   * @param {String} objId Object ID
   * @param {Object} config Configuration
   * @param {Object} config.parentId parentId Parent ID
   * @param {Boolean} config.deleteFinally
   * @param {Boolean} config.silent
   */
  deleteSord: function (objId, config) {
    var me = this,
        deleteOptions, id;
    me.logger.enter("deleteSord", arguments);
    config = config || {};
    config.parentId = config.parentId || "";

    id = me.getObjId(objId);
    if (!id) {
      if (!config.silent) {
        throw "Object not found: " + objId;
      }
      me.logger.exit("deleteSord");
      return;
    }
    ixConnect.ix().deleteSord(config.parentId + "", id + "", LockC.NO, null);
    if (config.deleteFinally) {
      deleteOptions = new DeleteOptions();
      deleteOptions.deleteFinally = true;
      ixConnect.ix().deleteSord(config.parentId + "", id + "", LockC.NO, deleteOptions);
    }
    me.logger.exit("deleteSord");
  },

  /**
   * @property {Object}
   * Special folders that can be referenced by GUIDs
   */
  specialFolders: {
    administrationFolder: ["ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:", "ARCPATH:/Administration"],
    bsFolder: ["ARCPATH[(E10E1000-E100-E100-E100-B10B10B10B00)]:", "{{administrationFolderPath}}/Business Solutions"],
    jcScriptingBaseFolder: ["ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E11)]:", "{{administrationFolderPath}}/Java Client Scripting Base"],
    ixScriptingBaseFolder: ["ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E12)]:", "{{administrationFolderPath}}/IndexServer Scripting Base"],
    webClientScriptingBaseFolder: ["ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E16)]", "{{administrationFolderPath}}/Webclient Scripting Base"],
    localizationBaseFolder: ["ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E1A)]:", "{{administrationFolderPath}}/Localization"],
    asBaseFolder: ["{{administrationFolderPath}}/ELOas Base"],
    wfBaseFolder: ["{{administrationFolderPath}}/ELOwf Base"],
    appsBaseFolder: ["{{administrationFolderPath}}/ELOapps"]
  },

  /**
   * Resolve special folders by GUID (see {@link #specialFolders})
   *
   *     var ressourcePath = sol.common.RepoUtils.resolveSpecialFolder("{{administrationFolderPath}}/Ressources");
   *
   * Supported variables:
   *
   *     {{administrationFolderPath}}
   *     {{bsFolderPath}}
   *     {{jcScriptingBaseFolderPath}}
   *     {{ixScriptingBaseFolderPath}}
   *     {{webClientScriptingBaseFolderPath}}
   *     {{localizationBaseFolderPath}}
   *     {{asBaseFolderPath}}
   *     {{wfBaseFolderPath}}
   *     {{appsBaseFolderPath}}
   *
   * @param {String} path Path to be resolved
   * @param {Object} paramObj Additional properties: packageName, packageBaseFolderPath
   * @return {String} Resolved Path
   */
  resolveSpecialFolder: function (path, paramObj) {
    var me = this,
        key;
    me.logger.enter("resolveSpecialFolder", arguments);
    if (!me.specialFolderPathsDeterminated) {
      me.determinateSpecialFolders();
    }
    paramObj = paramObj || {};
    for (key in me.specialFolderPaths) {
      paramObj[key] = me.specialFolderPaths[key];
    }
    if (paramObj.packageName) {
      if (paramObj.packageBaseFolderPath) {
        paramObj.packageBaseFolderPath = sol.create("sol.common.Template", { source: paramObj.packageBaseFolderPath, isRepoPath: true }).apply(paramObj);
      } else {
        paramObj.packageBaseFolderPath = paramObj.bsFolderPath;
      }
      paramObj.packageFolderPath = paramObj.packageBaseFolderPath + me.pilcrow + paramObj.packageName;
    }
    path = sol.create("sol.common.Template", { source: path, isRepoPath: true }).apply(paramObj);
    me.logger.exit("resolveSpecialFolder", path);
    return path;
  },

  /**
   * @private
   * Determinates special folders by its GUID or alternatively by a default path
   */
  determinateSpecialFolders: function () {
    var me = this,
        paths, path, folderKey, i;
    me.logger.enter("determinateSpecialFolders", arguments);
    me.specialFolderPaths = {};
    for (folderKey in me.specialFolders) {
      paths = me.specialFolders[folderKey];
      for (i = 0; i < paths.length; i++) {
        path = paths[i].replace("/", me.pilcrow);
        if (path.indexOf("{{") > -1) {
          path = sol.create("sol.common.Template", { source: path }).apply(me.specialFolderPaths);
        }
        try {
          ixConnect.ix().checkoutSord(path + "", SordC.mbOnlyId, LockC.NO);
          break;
        } catch (ignore) {
          // Object not found
        }
      }
      me.specialFolderPaths[folderKey + "Path"] = path;
    }
    me.specialFolderPathsDeterminated = true;
    me.logger.exit("determinateSpecialFolders");
  },

  /**
   * Checks the version of ELO components
   * @param {String} currentVersionString
   * @param {String} requiredVersionString
   * @return {Boolean} Return true if the current version is equal or higher then the required version
   */
  checkVersion: function (currentVersionString, requiredVersionString) {
    var me = this,
        result = true,
        currentRegex, requiredRegex, currentVersionMatch, requiredVersionMatch, currentPart, requiredPart;

    me.logger.enter("checkVersion", arguments);

    currentRegex = /([0-9]+(\\.[0-9]+)*)/g;
    requiredRegex = /([0-9]+(\\.[0-9]+)*)/g;
    currentVersionMatch = currentRegex.exec(currentVersionString);
    requiredVersionMatch = requiredRegex.exec(requiredVersionString);

    while (requiredVersionMatch !== null) {
      currentPart = (currentVersionMatch) ? parseInt(currentVersionMatch[0], 10) : 0;
      requiredPart = parseInt(requiredVersionMatch[0], 10);
      if (requiredPart > currentPart) {
        result = false;
        break;
      } else if (requiredPart < currentPart) {
        result = true;
        break;
      }
      currentVersionMatch = currentRegex.exec(currentVersionString);
      requiredVersionMatch = requiredRegex.exec(requiredVersionString);
    }

    me.logger.exit("checkVersion", result);

    return result;
  },

  /**
   * Checks the versions of ELO components based on the main version.
   * For each main version can be a minimum requirement.
   * If there is no specific requirement for the main current main version, the highest required main version will be checked.
   *
   * Examples:
   *     sol.common.RepoUtils.checkVersions("9.03.26", ["9.03.021", "10.01.044"]);  // => true  (min requirement for ELO 9 satisfied)
   *     sol.common.RepoUtils.checkVersions("10.01.38", ["9.03.021", "10.01.044"]); // => false (min requirement for ELO 10 not satisfied)
   *     sol.common.RepoUtils.checkVersions("11.00.02", ["9.03.021", "10.01.044"]); // => true  (no min requirement for ELO 11, but version is higher than '10.01.044')
   *
   * @param {String} currentVersionString
   * @param {String[]} requiredMainVersionStrings
   * @return {Boolean} Return true if the current version is equal or higher then the required version
   */
  checkVersions: function (currentVersionString, requiredMainVersionStrings) {
    var me = this,
        mainVersionLookup = {},
        highestMainVersion = 0,
        getMainVersion, currentMainVersion, requiredVersionForMainVersion;

    getMainVersion = function (version) {
      return +version.substring(0, version.indexOf("."));
    };

    currentMainVersion = getMainVersion(currentVersionString);

    requiredMainVersionStrings.forEach(function (requiredVersion) {
      var requiredMainVersion = getMainVersion(requiredVersion);
      mainVersionLookup[requiredMainVersion] = requiredVersion;
      highestMainVersion = (highestMainVersion < requiredMainVersion) ? requiredMainVersion : highestMainVersion;
    });

    requiredVersionForMainVersion = mainVersionLookup[currentMainVersion] || mainVersionLookup[highestMainVersion];

    return me.checkVersion(currentVersionString, requiredVersionForMainVersion);
  },

  /**
   * Returns the object IDs of the repository path elements in ascending order
   * @param {String} objId object ID
   * @return {Array} Array of object IDs
   */
  getRepoPathObjIds: function (objId) {
    var me = this,
        sord, objIds, i,
        repoPathElements, repoPathElement;
    me.logger.enter("getRepoPathObjIds", arguments);

    sord = ixConnect.ix().checkoutSord(objId, new SordZ(SordC.mbRefPaths), LockC.NO);
    objIds = [objId];
    if (!sord.refPaths || (sord.refPaths.length == 0)) {
      throw "sord.refPaths is empty";
    }

    objIds = [objId];
    repoPathElements = sord.refPaths[0].path;
    for (i = repoPathElements.length - 1; i >= 0; i--) {
      repoPathElement = repoPathElements[i];
      objIds.push(repoPathElement.id);
    }
    me.logger.exit("getRepoPathObjIds", objIds);
    return objIds;
  },

  /**
   * Finds a valid parent of a sord with specified index field
   * @param {String} objId Object ID
   * @param {String} type Name of group
   * @param {String[]} values Values
   * @return {de.elo.ix.client.Sord.id} objId
   */
  getValidParent: function (objId, type, values) {
    var me = this,
        sord;
    me.logger.enter("getValidParent", arguments);

    if (typeof values == "string") {
      values = [values];
    }

    sord = sol.common.RepoUtils.findInHierarchy(objId, { objKeyName: type, objKeyValues: values });
    if (sord != undefined) {
      me.logger.exit("getValidParent", sord.id);
      return sord.id;
    } else {
      me.logger.exit("getValidParent", null);
      return null;
    }
  },

  /**
   * Finds a sord in the hierarchy by the index field 'SOL_TYPE'
   * @param {String} objId Object ID
   * @param {String[]} values Values
   * @param {Object} config Configuration
   * @param {de.elo.ix.client.IXConnection} config.connection Index server connection
   * @return {de.elo.ix.client.Sord} Sord
   */
  findObjectTypeInHierarchy: function (objId, values, config) {
    var me = this,
        _result;
    me.logger.enter("findObjectTypeInHierarchy", arguments);
    config = config || {};
    _result = me.findInHierarchy(objId, { objKeyName: "SOL_TYPE", objKeyValues: values, connection: config.connection });
    me.logger.exit("findObjectTypeInHierarchy", _result);
    return _result;
  },

  /**
   * Find a sord in the hierarchy
   * @param {String} objId Object ID
   * @param {Object} config Optional parameters
   * @param {String[]} config.sordTypeNames Name of sord types
   * @param {String} config.objKeyName Name of the oject key
   * @param {String[]} config.objKeyValues Values of the object key
   * @param {de.elo.ix.client.IXConnection} config.connection Index server connection
   * @param {de.elo.ix.client.SordZ} config.sordZ Element selector
   * @param {Boolean} config.throwException If true a exception is thrown if no sord was found
   * @return {de.elo.ix.client.Sord} Sord
   */
  findInHierarchy: function (objId, config) {
    var me = this,
        conn, objIds, sords, i, sord, j, sordTypeIds, sordTypeId,
        objKeyName, objKeyValues, objKeyValue, currentValue;
    me.logger.enter("findInHierarchy", arguments);

    config = config || {};
    conn = config.connection || ixConnect;

    if (!objId) {
      throw "Object ID is empty";
    }

    if (config.sordTypeNames) {
      if (!sol.common.ObjectUtils.isArray(config.sordTypeNames)) {
        throw "Sord type names must be an array";
      }

      config.sordZ = config.sordZ || SordC.mbLean;

      sordTypeIds = config.sordTypeNames.map(function (sordTypeName) {
        return sol.common.SordTypeUtils.getSordTypeId(sordTypeName);
      });
    }

    if (config.objKeyName) {
      if (!sol.common.ObjectUtils.isArray(config.objKeyValues)) {
        throw "Objkey values must be an array";
      }

      config.sordZ = config.sordZ || SordC.mbAllIndex;
    }

    config.sordZ = config.sordZ || SordC.mbAll;

    objIds = me.getRepoPathObjIds(objId);
    objKeyName = config.objKeyName;
    objKeyValues = config.objKeyValues;

    sords = me.getSords(objIds, { sordZ: config.sordZ, keepOrder: true, connection: conn });
    for (i = 0; i < sords.length; i++) {
      sord = sords[i];
      if (sordTypeIds) {
        for (j = 0; j < sordTypeIds.length; j++) {
          sordTypeId = sordTypeIds[j];
          if (sord.type == sordTypeId) {
            me.logger.exit("findInHierarchy", sord);
            return sord;
          }
        }
      }
      if (objKeyName) {
        currentValue = sol.common.SordUtils.getObjKeyValue(sord, objKeyName);
        if (currentValue) {
          for (j = 0; j < objKeyValues.length; j++) {
            objKeyValue = objKeyValues[j];
            if (objKeyValue == currentValue) {
              me.logger.exit("findInHierarchy", sord);
              return sord;
            }
          }
        }
      }
    }
    if (config.throwException) {
      throw "No appropriate predecessor found: objId=" + objId + ", config=" + sol.common.JsonUtils.stringifyAll(config);
    }
    me.logger.exit("findInHierarchy");
  },

  /**
   * Moves documents to a given storage path
   * @param {String} startObjId Start object ID
   * @param {String} dstStoragePathId
   */
  moveToStoragePath: function (startObjId, dstStoragePathId) {
    var me = this,
        navInfo, procInfo, jobState;
    me.logger.enter("moveToStoragePath", arguments);

    if (!startObjId) {
      throw "Start object ID is empty";
    }

    if (!dstStoragePathId) {
      throw "Storage path name is empty";
    }

    navInfo = new NavigationInfo();
    navInfo.startIDs = [startObjId];

    procInfo = new ProcessInfo();
    procInfo.desc = "Move to storage path";
    procInfo.errorMode = ProcessInfoC.ERRORMODE_SKIP_PROCINFO;

    procInfo.procMoveDocumentsToStoragePath = new ProcessMoveDocumentsToStoragePath();
    procInfo.procMoveDocumentsToStoragePath.pathId = dstStoragePathId;

    jobState = ixConnect.ix().processTrees(navInfo, procInfo);

    sol.common.AsyncUtils.waitForJob(jobState.jobGuid);
    me.logger.exit("moveToStoragePath");
  },

  /**
   * Sets a session option
   * @param {Number} sessionOption Session option
   * @param {Boolean|String} value Value
   */
  setSessionOption: function (sessionOption, value) {
    var me = this,
        sessionOptions = {};

    if (typeof sessionOption == "undefined") {
      throw "Option is empty";
    }

    if (typeof value == "undefined") {
      throw "Value is empty";
    }

    if (typeof value == "boolean") {
      value = value ? "true" : "false";
    }

    sessionOptions[sessionOption] = value;

    me.setSessionOptions(sessionOptions);
  },

  /**
   * Sets session options
   * @param {Object} newOptions Options, e.g. { SessionOptionsC.START_DOC_WORKFLOWS: true }
   */
  setSessionOptions: function (newOptions) {
    var sessionOptions, sessionOptionsObj, key, currOption, newValue;

    if (!newOptions) {
      throw "Options are empty";
    }

    sessionOptions = ixConnect.ix().sessionOptions;
    sessionOptionsObj = sol.common.ObjectUtils.getObjectFromArray(sessionOptions.options, "key");

    for (key in newOptions) {
      if (newOptions.hasOwnProperty(key)) {
        currOption = sessionOptionsObj[String(key)];
        newValue = newOptions[key];
        if (currOption) {
          currOption.value = newValue;
        } else {
          sessionOptionsObj[String(key)] = new KeyValue(key, newValue);
        }
      }
    }
    sessionOptions.options = sol.common.ObjectUtils.getValues(sessionOptionsObj);
    ixConnect.ix().setSessionOptions(sessionOptions);
  },

  /**
   * Get session options
   * @returns {Object}
   */
  getSessionOptions: function () {
    var sessionOptions,
        sessionOptionsObj = {},
        i, keyValue;

    sessionOptions = ixConnect.ix().sessionOptions;

    for (i = 0; i < sessionOptions.length; i++) {
      keyValue = sessionOptions[i];
      sessionOptionsObj[keyValue.key + ""] = keyValue.value + "";
    }

    return sessionOptionsObj;
  },

  /**
   * Creates a new connection factory
   * @param {java.util.Properties} connProps Connection properties
   * @param {java.util.Properties} sessOpts Session options
   * @param {Object} overrideParams Overide Parameters
   * @param {de.elo.ix.client.IXConnection} overrideParams.conn Connection
   * @param {Object} overrideParams.connProps Change connection properties
   * @param {Number} overrideParams.timeoutSeconds Timeout seconds
   * @returns {Object}
   *
   * Example:
   *
   *     conn = sol.common.RepoUtils.createConnFact(connProps, sessOpts, {
   *       timeoutSeconds: 300
   *     });
   */
  createConnFact: function (connProps, sessOpts, overrideParams) {
    var connFact, key;

    connProps = connProps || new java.util.Properties();
    sessOpts = sessOpts || new java.util.Properties();

    overrideParams = overrideParams || {};
    overrideParams.connProps = overrideParams.connProps || {};

    for (key in overrideParams.connProps) {
      connProps.setProperty(key, overrideParams.connProps[key]);
    }

    if (overrideParams.timeoutSeconds) {
      connProps.setProperty(IXConnFactory.PROP_TIMEOUT_SECONDS, overrideParams.timeoutSeconds + "");
    }

    connFact = new IXConnFactory(connProps, sessOpts);

    return connFact;
  },

  /**
   * Returns the color ID
   * @param {String} colorName Color name
   * @return {String} Color ID
   */
  getColorId: function (colorName) {
    var me = this,
        color;

    if (!me.colors) {
      me.readColors();
    }
    colorName = String(colorName).toLowerCase();
    color = me.colors[colorName];
    if (color) {
      return String(color.id);
    }
  },

  /**
   * Returns an object that contains all colors
   * @return {Object} Colors
   */
  readColors: function () {
    var me = this,
        colors, i, color, colorName;

    me.colors = {};

    colors = ixConnect.ix().checkoutColors(LockC.NO);
    for (i = 0; i < colors.length; i++) {
      color = colors[i];
      colorName = String(color.name).toLowerCase();
      me.colors[colorName] = color;
    }

    return me.colors;
  },

  /**
   * Adds colors, if they doesn't exist
   * @param {Array} newColors Colors, example: [{ name: "sol.solution.processed", rgb: "2129920" }]
   * @return {String[]}
   */
  addColors: function (newColors) {
    var me = this,
        createdColorNames = [];

    if (!newColors) {
      throw "New colors are empty";
    }

    newColors.forEach(function (newColor) {
      var colorData;
      if (!me.colorExists(newColor.name)) {
        colorData = new ColorData();
        colorData.id = -1;
        colorData.name = newColor.name;
        colorData.RGB = newColor.rgb;
        me.colors[newColor.name] = colorData;
        createdColorNames.push(newColor.name);
        me.colorsDirty = true;
      }
    });

    me.writeColors();
    return createdColorNames;
  },

  /**
   * Checks wether a color exists
   * @param {String} colorName Color name
   * @return {Boolean}
   */
  colorExists: function (colorName) {
    var me = this;
    if (!colorName) {
      throw "Color name is empty";
    }
    if (!me.colors) {
      me.readColors();
    }
    colorName = String(colorName).toLowerCase();
    return !!me.colors[colorName];
  },

  /**
   * Writes all colors
   */
  writeColors: function () {
    var me = this,
        colorArr;
    if (me.colorsDirty) {
      colorArr = sol.common.ObjectUtils.getValues(me.colors);
      ixConnect.ix().checkinColors(colorArr, LockC.NO);
    }
    me.colors = undefined;
    me.colorsDirty = false;
  },

  /**
   * Copy Sords
   * @param {Array|String} startIds Start object IDs
   * @param {String} newParentId New parent object ID
   * @param {Object} params parameters
   * @param {String} params.targetName Target name
   * @param {Boolean} [params.copyOnlyBaseElement=true] If true only the base element will be copied
   * @param {Boolean} [params.copyOnlyWorkversion=true] If true only the work version will be copied
   * @param {Boolean} [params.copyStructuresAndDocuments=true] If true structures and documents will be copied
   * @param {Boolean} [params.takeTargetPermissions=true] If true the target permissions will be set
   * @param {Boolean} [params.keepOriginalPermissions=false] If true the original permissions will be kept
   * @param {Boolean} [params.keepOriginalPermissions=false] If true the original permissions will be kept
   * @param {de.elo.ix.client.IXConnection} params.connection (optional) Index server connection
   * @return {Object}
   */
  copySords: function (startIds, newParentId, params) {
    var me = this,
        resultObj = {},
        navInfo, procInfo, jobState, entriesIterator, pair, dstFolderId, conn;

    params = params || {};
    params.copyOnlyBaseElement = (params.copyOnlyBaseElement == undefined) ? true : params.copyOnlyBaseElement;
    params.copyOnlyWorkversion = (params.copyOnlyWorkversion == undefined) ? true : params.copyOnlyWorkversion;
    params.copyStructuresAndDocuments = (params.copyStructuresAndDocuments == undefined) ? true : params.copyStructuresAndDocuments;
    params.takeTargetPermissions = (params.takeTargetPermissions == undefined) ? true : params.takeTargetPermissions;
    params.keepOriginalPermissions = (params.keepOriginalPermissions == undefined) ? false : params.keepOriginalPermissions;
    conn = params.connection || ixConnect;

    if (sol.common.ObjectUtils.isArray(startIds)) {
      if (startIds.length == 0) {
        throw "Start IDs array is empty";
      }
    } else {
      if (!startIds) {
        throw "Start IDs are empty";
      } else {
        startIds = [startIds];
      }
    }

    if (!newParentId) {
      throw "Parent ID is empty";
    }

    dstFolderId = me.getObjId(newParentId);

    if (!dstFolderId) {
      throw "Destination folder ID can't be found";
    }

    navInfo = new NavigationInfo();
    navInfo.startIDs = startIds;

    procInfo = new ProcessInfo();
    procInfo.desc = "Copy sords";
    procInfo.errorMode = ProcessInfoC.ERRORMODE_CRITICAL_ONLY;

    procInfo.procCopyElements = new ProcessCopyElements();
    procInfo.procCopyElements.copyOptions = new CopyOptions();
    if (params.targetName) {
      procInfo.procCopyElements.copyOptions.targetName = params.targetName;
    }

    procInfo.procCopyElements.createMapping = true;
    procInfo.procCopyElements.copyOptions.newParentId = dstFolderId;
    procInfo.procCopyElements.copyOptions.copyOnlyBaseElement = params.copyOnlyBaseElement;
    procInfo.procCopyElements.copyOptions.copyOnlyWorkversion = params.copyOnlyWorkversion;
    procInfo.procCopyElements.copyOptions.copyStructuresAndDocuments = params.copyStructuresAndDocuments;
    procInfo.procCopyElements.copyOptions.takeTargetPermissions = params.takeTargetPermissions;
    procInfo.procCopyElements.copyOptions.keepOriginalPermissions = params.keepOriginalPermissions;

    me.logger.debug(["Copy sords: startIds = '{0}', newParent.id = '{1}'", startIds, newParentId]);

    jobState = conn.ix().processTrees(navInfo, procInfo);

    jobState = sol.common.AsyncUtils.waitForJob(jobState.jobGuid, { connection: conn });

    me.logger.debug(["Job '{0}' finished: jobState.countProcessed = '{1}', jobState.countErrors = '{2}'", procInfo.desc, jobState.countProcessed, jobState.countErrors]);

    entriesIterator = jobState.procInfo.procCopyElements.copyResult.mapIdsSource2Copy.entrySet().iterator();

    while (entriesIterator.hasNext()) {
      pair = entriesIterator.next();
      resultObj[String(pair.key)] = String(pair.value);
    }

    return resultObj;
  },

  /**
   * Detects the runtime context
   * @return {String} Context, ´JC´, ´AS´ or ´IX´
   */
  detectScriptEnvironment: function () {
    if (typeof workspace != "undefined") {
      return "JC";
    } else if (typeof emConnect != "undefined") {
      return "AS";
    } else if ((typeof $ENV != "undefined") || (typeof EloShellScriptRunner != "undefined")) {
      return "SH";
    } else {
      try {
        java.lang.Class.forName("de.elo.ix.jscript.DBConnection");
        return "IX";
      } catch (ignore) {
        // ignore
      }
    }
    throw "Can't determinate runtime context.";
  },

  /**
   * Moves Sords
   * @param {Array} objIds Object IDs
   * @param {String} dstFolderId Destination folder ID
   * @param {Object} params parameters
   * @param {String} [params.manSortIdx=-1] Manually determine the position
   * @param {String} [params.adjustAclOverwrite=true] Adjust the ACL
   */
  moveSords: function (objIds, dstFolderId, params) {
    var conn, copyInfo, i, objId;

    if (!objIds || (objIds.length == 0)) {
      return;
    }

    if (!dstFolderId) {
      throw "Destination folder ID is empty";
    }

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;

    params = params || {};
    copyInfo = new CopyInfo();
    copyInfo.manSortIdx = (typeof params.manSortIdx == "undefined") ? -1 : params.manSortIdx;
    copyInfo.adjustAclOverwrite = (typeof params.adjustAclOverwrite == "undefined") ? true : params.adjustAclOverwrite;

    for (i = 0; i < objIds.length; i++) {
      objId = objIds[i];
      conn.ix().copySord(dstFolderId, objId, copyInfo, CopySordC.MOVE);
    }
  },

  /**
   * Creates an external link
   * @param {Object} params Parameters
   * @param {String} params.objId Object ID
   * @param {String} params.limitTo Limit to
   * @param {String} [params.limitToUnit=d] Limit to unit, e.g. days
   * @param {Number} params.times times Times
   * @param {Boolean} [params.escapeXml=false] Escape the URL for use in XML
   * @return {String} URL
   */
  createExternalLink: function (params) {
    var downloadOptions, publicDownload, expiration, expirationIso, url;

    params = params || {};
    params.limitToUnit = params.limitToUnit || "d";
    params.times = params.times || java.lang.Integer.MAX_VALUE;

    if (!params.objId) {
      throw "Object ID is missing";
    }

    // eslint-disable-next-line no-undef
    downloadOptions = new PublicDownloadOptions();
    downloadOptions.objId = params.objId;

    if (params.limitTo) {
      expiration = moment().add(params.limitTo, params.limitToUnit);
      expirationIso = expiration.format("YYYYMMDDHHmmss");
      downloadOptions.expiration = expirationIso;
    }

    if (params.times) {
      downloadOptions.remaining = params.times;
    }
    publicDownload = ixConnect.ix().insertPublicDownload(downloadOptions);

    url = publicDownload.url;

    if (params.escapeXml) {
      try {
        url = Packages.org.apache.commons.text.StringEscapeUtils.escapeXml11(url) + "";
      } catch (ex) {
        url = Packages.org.apache.commons.lang.StringEscapeUtils.escapeXml(url) + "";
      }
    }

    return url;
  },

  /**
   * Returns object IDs by a given ´findInfo´ object
   * @param {de.elo.ix.client.FindInfo} findInfo Find info
   * @param {Object} params Parameters
   * @param {String} params.findMax
   * @param {de.elo.ix.client.SordZ} params.sordZ SordZ
   * @return {Array}
   */
  findIds: function (findInfo, params) {
    var idx = 0,
        ids = [],
        findResult, i;

    if (!findInfo) {
      throw "FindInfo is empty";
    }

    params = params || {};
    params.findMax = params.findMax || 1000;
    params.sordZ = params.sordZ || SordC.mbOnlyId;

    findResult = ixConnect.ix().findFirstSords(findInfo, params.findMax, params.sordZ);

    ids = [];

    while (true) {
      for (i = 0; i < findResult.ids.length; i++) {
        ids.push(findResult.ids[i] + "");
      }
      if (!findResult.moreResults) {
        break;
      }
      idx += findResult.ids.length;
      findResult = ixConnect.ix().findNextSords(findResult.searchId, idx, params.findMax, params.sordZ);
    }
    ixConnect.ix().findClose(findResult.searchId);

    return ids;
  },

  /**
   * Returns IX options
   * @param {String} key Key
   * @return {Object} entry Entry
   * @return {String} Value
   */
  getIxOption: function (key) {
    var me = this,
        ixOptions, i, ixOption, ixId;

    if (!key) {
      throw "IX option key is empty";
    }

    ixOptions = me.getIxOptions();

    ixOptions = ixOptions.filter(function (entry) {
      return (entry[1] == key);
    });

    ixId = me.getIxId();

    for (i = 0; i < ixOptions.length; i++) {
      ixOption = ixOptions[i];
      if (ixOption[0] == ixId) {
        return ixOption[2];
      }
    }

    for (i = 0; i < ixOptions.length; i++) {
      ixOption = ixOptions[i];
      if (ixOption[0] == "_ALL") {
        return ixOption[2];
      }
    }
  },

  /**
   * Returns the IX options
   * @return {Array} IX options
   */
  getIxOptions: function () {
    var i, keyValuePairs, keyValuePair, completeKey, keyGroups, key, ixId,
        ixOptions = [];

    keyValuePairs = ixConnect.ix().checkoutMap(MapDomainC.DOMAIN_IX_OPTIONS, null, null, LockC.NO).items;

    for (i = 0; i < keyValuePairs.length; i++) {
      keyValuePair = keyValuePairs[i];
      completeKey = keyValuePair.key + "";
      keyGroups = completeKey.match(/(?:\[)(.+)(?:\])(.+)/);
      if (keyGroups && (keyGroups.length == 3)) {
        key = keyGroups[2];
        ixId = keyGroups[1];
        ixOptions.push([ixId, key, keyValuePair.value + ""]);
      }
    }

    return ixOptions;
  },

  /**
   * Returns the IX ID
   * @return {String} IX ID
   */
  getIxId: function () {
    var serverInfo, ixId;

    serverInfo = ixConnect.ix().serverInfo;
    ixId = serverInfo.instanceName + "";

    return ixId;
  },

  /**
   * Calculates the next version number of a document.
   *
   *     newVersion = sol.common.RepoUtils.calcNextVersion("4711", 1);
   *
   * @param {String} objId Object ID
   * @param {Number} increaseBy (optional) Increase by
   * @return {String} New version
   */
  calcNextVersion: function (objId, increaseBy) {
    var me = this,
        sord, lastVersion, newVersion, posDot, posComma, posSpace, pos, left, right, i, char, chars, lastNumericChar;

    increaseBy = increaseBy || 1;

    me.logger.enter("calcNextVersion", arguments);
    if (!objId) {
      throw "ObjId is empty";
    }

    increaseBy = parseInt(increaseBy, 10);
    if (isNaN(increaseBy)) {
      throw "increaseBy is not a number";
    }

    sord = ixConnect.ix().checkoutSord(objId, EditInfoC.mbSord, LockC.NO).sord;
    lastVersion = sord.docVersion.version + "";

    if (lastVersion) {
      posDot = lastVersion.lastIndexOf(".");
      posComma = lastVersion.lastIndexOf(",");
      posSpace = lastVersion.lastIndexOf(" ");

      newVersion = parseFloat(lastVersion) + increaseBy;

      if (isNaN(newVersion) || posDot > -1 || posComma > -1 || posSpace > 1) {
        pos = Math.max(posDot, posComma);
        pos = Math.max(pos, posSpace);

        left = lastVersion.substring(0, pos + 1);
        right = lastVersion.substring(pos + 1);

        right = parseInt(right, 10) + increaseBy;
        if (isNaN(right)) {
          chars = [];
          for (i = lastVersion.length; i > 0; i--) {
            char = lastVersion[i - 1];
            if (!isNaN(parseInt(char, 10))) {
              chars.push(char);
            } else {
              lastNumericChar = i;
              break;
            }
          }

          if (chars.length > 0) {
            right = chars.reverse().join("");
            right = parseInt(right, 10) + increaseBy;

            left = lastVersion.substring(0, lastNumericChar);
            newVersion = left + right;
          }
        } else {
          newVersion = left + right;
        }
      }
    }

    if (!newVersion) {
      newVersion = lastVersion ? (lastVersion + " 1") : "1";
    }

    me.logger.exit("calcNextVersion", newVersion);
    return newVersion + "";
  },

  /**
   * Returns an elodms link for the specified objId.
   *
   * e.g.: elodms://1234
   *
   * @param {String} objId Object ID or guid
   * @return {String} elodms-Link
   */
  getEloDmsLink: function (objId) {
    var me = this;

    if (!(me.isObjId(objId) || me.isGuid(objId))) {
      throw Error("No objId or guid given");
    }

    return "elodms://" + objId;
  },

  /**
   * Returns an elodms link for the specified objId.
   **
   * @param {String} guid Object guid
   * @return {String} Webclient-Link
   */
  getWebLink: function (guid) {
    var me = this,
        ixUrl, webBaseUrl, link;

    if (!me.isGuid(guid)) {
      throw Error("No guid given");
    }

    ixUrl = ixConnect.endpointUrl + "";
    webBaseUrl = ixUrl.substring(0, ixUrl.length - 3) + "/plugin/de.elo.ix.plugin.proxy/web";

    link = webBaseUrl + "/#/archive/" + guid;

    return link;
  },

  /**
   * Detects if Imex export format is used
   *
   * @return {Boolean} Is Imex export format used?
   */
  isImexExportFormat: function () {
    var newgenarchiveexport;

    if (sol.common.RepoUtils.checkVersion(ixConnect.implVersion, "21.4")) {
      newgenarchiveexport = sol.common.RepoUtils.getIxOption("ix.feature.preview.enable.newgenarchiveexport");
      newgenarchiveexport = ((newgenarchiveexport || "") + "").toLowerCase();
      if (newgenarchiveexport == "false") {
        return false;
      }

      return true;
    }

    return false;
  }
});
