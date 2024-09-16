
//@include lib_Class.js
//@include lib_sol.common.FileUtils.js
//@include lib_sol.common.RepoUtils.js

/**
 * This class provides basic functionality for sord types.
 *
 * @author ELO Digital Office GmbH
 *
 * @eloas
 * @eloix
 *
 * @requires sol.common.RepoUtils
 * @requires sol.common.FileUtils
 *
 */
sol.define("sol.common.SordTypeUtils", {
  singleton: true,

  /**
   * Returns the sord types
   * @return {Object}
   */
  getSordTypes: function () {
    var me = this;
    me.logger.enter("getSordTypes", arguments);
    me.readSordTypes();
    me.logger.exit("getSordTypes", me.sordTypesObj);

    return me.sordTypesObj;
  },

  /**
   * @private
   * Reads the sord types
   */
  readSordTypes: function () {
    var me = this,
        sordTypes, i, sordType;

    if (me.sordTypesObj) {
      return;
    }

    sordTypes = ixConnect.ix().checkoutSordTypes(null, Packages.de.elo.ix.client.SordTypeC.mbNoIcons, LockC.NO);

    for (i = 0; i < sordTypes.length; i++) {
      sordType = sordTypes[i];
      me.insertSordTypeIntoCache(sordType.id, sordType.name);
    }
  },

  /**
   * Returns the sord type ID
   * @param {String} name
   * @return {String} Sord type ID
   */
  getSordTypeId: function (name) {
    var me = this;

    me.readSordTypes();
    if (!me.sordTypeExists(name)) {
      throw "Sord type '" + name + "' doesn't exist";
    }
    return parseInt(me.sordTypesObj[name].id, 10);
  },

  /**
   * @private
   * Inserts a sord type into the local sord types cache
   * @param {String} id
   * @param {String} name
   */
  insertSordTypeIntoCache: function (id, name) {
    var me = this,
        kind;

    if (!id) {
      throw "Sord type ID is empty";
    }
    if (!name) {
      return;
    }
    if (!me.sordTypesObj) {
      me.sordTypesObj = {};
      me.folderSordTypeMaxId = 0;
      me.docSordTypeMaxId = 0;
    }

    kind = me.determinateSordTypeKind(id);
    me.sordTypesObj[name] = { id: id, kind: kind };

    if (kind == "FOLDER") {
      if (id > me.folderSordTypeMaxId) {
        me.folderSordTypeMaxId = id;
      }
    } else if (kind == "DOCUMENT") {
      if (id > me.docSordTypeMaxId) {
        me.docSordTypeMaxId = id;
      }
    }
  },

  /**
   * Determinates the sord type kind (folder/document) of a sord type
   * @param {type} id
   * @returns {undefined}
   */
  determinateSordTypeKind: function (id) {
    if (typeof id == "undefined") {
      throw "Sord type ID is empty";
    }

    if (id == "9999") {
      return "REPOSITORY";
    } else if (id <= 253) {
      return "FOLDER";
    } else if (id <= 9998) {
      return "DOCUMENT";
    }
  },

  /**
   * Checks wether a sord type exists
   * @param {String} name
   * @returns {Boolean}
   */
  sordTypeExists: function (name) {
    var me = this;
    return !!me.sordTypesObj[name];
  },

  /**
   * Create sord type
   * @param {String} id ID
   * @param {String} name Name
   * @param {String} kind, e.g. "FOLDER", "DOCUMENT"
   * @param {Array} iconFileDataArray Array of file data for icons
   * @param {Array} disabledIconFileDataArray Array of file data for disabled icons
   * @param {Array} linkIconFileDataArray Array of file data for link icons
   * @param {Array} extensions
   * @param {Array} force Force
   * @return {Boolean} If true the sord type was installed
   */
  createSordType: function (id, name, kind, iconFileDataArray, disabledIconFileDataArray, linkIconFileDataArray, extensions, force) {
    var me = this,
        sordTypes, i;

    me.logger.enter("createSordType", arguments);
    sordTypes = [];

    me.readSordTypes();
    if (!name) {
      throw "Sord type name is empty";
    }
    if (!kind) {
      throw "sord type kind (folder/document) is empty";
    }

    if (me.sordTypeExists(name) && !force) {
      me.logger.debug(["Sord type '{0}' already exists.", name]);
      return false;
    }

    if (!id) {
      switch (kind) {
        case "FOLDER":
          id = me.folderSordTypeMaxId + 1;
          break;

        case "DOCUMENT":
          id = me.docSordTypeMaxId + 1;
          break;

        default:
          throw "Unsupported sord type kind: " + kind;
      }
    }

    if ((kind == "DOCUMENT") && !extensions) {
      throw "config.extensions must not be empty for document types";
    }

    extensions = extensions || [];

    for (i = 0; i < iconFileDataArray.length; i++) {
      sordTypes.push(me.buildSordType(id, name, iconFileDataArray[i], disabledIconFileDataArray[i], linkIconFileDataArray[i], extensions));
    }

    ixConnect.ix().checkinSordTypes(sordTypes, LockC.NO);

    me.insertSordTypeIntoCache(id, name);

    return true;
  },

  /**
   * @private
   * Build sord type
   * @param {String} id
   * @param {String} name
   * @param {de.elo.ix.client.FileData} iconFileData
   * @param {de.elo.ix.client.FileData} disabledIconFileData
   * @param {de.elo.ix.client.FileData} linkIconFileData
   * @param {Array} extensions
   * @return {de.elo.ix.client.SordType}
   */
  buildSordType: function (id, name, iconFileData, disabledIconFileData, linkIconFileData, extensions) {
    var sordType = new SordType();

    if (!id) {
      throw "Sord type ID is empty";
    }
    if (!name) {
      throw "Sord type name is empty";
    }
    if (!iconFileData) {
      throw "Sord type icon file data is empty";
    }
    if (!disabledIconFileData) {
      throw "Sord type disabled icon file data is empty";
    }
    if (!linkIconFileData) {
      throw "Sord type link icon file data is empty";
    }

    sordType.id = new java.lang.Integer(id);
    sordType.name = name;
    sordType.extensions = extensions || [];
    sordType.icon = iconFileData;
    sordType.disabledIcon = disabledIconFileData;
    sordType.workflowIcon = linkIconFileData;

    return sordType;
  },

  sordTypeIconConfigs: {
    bmp: { contentType: "image/bmp", sordTypeZ: Packages.de.elo.ix.client.SordTypeC.mbAllBMP },
    ico: { contentType: "image/x-ico", sordTypeZ: Packages.de.elo.ix.client.SordTypeC.mbAllICO },
    jpg: { contentType: "image/jpeg", sordTypeZ: Packages.de.elo.ix.client.SordTypeC.mbAllJPG },
    png: { contentType: "image/png", sordTypeZ: Packages.de.elo.ix.client.SordTypeC.mbAllPNG }
  },

  /**
   * Export a sord type to the file system
   * @param {Array} names Names of the sord type
   * @param {String} dirPath Path of the destination folder
   */
  exportSordTypes: function (names, dirPath) {
    var me = this,
        name, i, j, sordTypeIconExtensions;

    me.logger.enter("exportSordTypes", arguments);
    if (!names) {
      throw "Sord type names are empty";
    }

    if (!dirPath) {
      throw "config.folderTypesDirPath is empty";
    }

    sordTypeIconExtensions = sol.common.RepoUtils.checkVersion(ixConnect.implVersion, "23.02.000") ? ["ico"] : ["ico", "bmp", "jpg", "png"];

    for (i = 0; i < names.length; i++) {
      name = names[i];
      for (j = 0; j < sordTypeIconExtensions.length; j++) {
        me.exportSordType(name, sordTypeIconExtensions[j], dirPath, (j == 0));
      }
    }
    me.logger.exit("exportSordTypes");
  },

  /**
   * Export a sord types icons
   * @param {String} name Name of the sord type
   * @param {String} iconExtension Icon extension
   * @param {String} baseDirPath Path of the destination folder
   * @param {Boolean} exportConfig the configuration to a JSON file
   */
  exportSordType: function (name, iconExtension, baseDirPath, exportConfig) {
    var me = this,
        sordTypeId, sordTypeZ, sordTypeKind,
        sordTypeDirPath, sordTypeDir, sordType,
        iconFilePath, disabledIconFilePath, linkIconFilePath,
        configFilePath, config, extensions, i;

    if (!name) {
      throw "Sord type name is empty";
    }

    if (!baseDirPath) {
      throw "Destination folder path is empty";
    }

    sordTypeId = me.getSordTypeId(name);

    sordTypeZ = me.sordTypeIconConfigs[iconExtension].sordTypeZ;

    sordType = ixConnect.ix().checkoutSordTypes([sordTypeId], sordTypeZ, LockC.NO)[0];

    sordTypeKind = me.determinateSordTypeKind(sordType.id);

    sordTypeDirPath = baseDirPath + File.separator + name;
    sordTypeDir = new File(sordTypeDirPath);
    sordTypeDir.mkdirs();

    try {
      iconFilePath = sordTypeDirPath + File.separator + "Icon." + iconExtension;
      sol.common.FileUtils.saveFileData(sordType.icon, iconFilePath);

      disabledIconFilePath = sordTypeDirPath + File.separator + "Disabled icon." + iconExtension;
      sol.common.FileUtils.saveFileData(sordType.disabledIcon, disabledIconFilePath);

      linkIconFilePath = sordTypeDirPath + File.separator + "Link icon." + iconExtension;
      sol.common.FileUtils.saveFileData(sordType.workflowIcon, linkIconFilePath);
    } catch (ex) {
      throw "Can't save entry type '" + name + "' : " + ex;
    }

    if (exportConfig) {
      configFilePath = sordTypeDirPath + File.separator + "config.json";
      extensions = [];
      if (sordType.extensions) {
        for (i = 0; i < sordType.extensions.length; i++) {
          extensions.push(sordType.extensions[i] + "");
        }
      }
      config = {
        id: sordTypeId,
        name: name,
        kind: sordTypeKind,
        extensions: extensions
      };
      sol.common.FileUtils.writeConfigToFile(configFilePath, config);
    }
  },

  /**
   * Set sord type
   * @param {String} objId Object ID
   * @param {String} sordTypeName Sord type name
   */
  setSordType: function (objId, sordTypeName) {
    var me = this,
        sordZ, sord, sordType;

    if (!objId) {
      throw "Object ID is empty";
    }
    if (!sordTypeName) {
      throw "Sord type name is empty";
    }

    sordType = me.getSordTypeId(sordTypeName);

    sordZ = new SordZ(ObjDataC.mbType);
    sord = ixConnect.ix().checkoutSord(objId, sordZ, LockC.NO);
    sord.type = sordType;
    ixConnect.ix().checkinSord(sord, sordZ, LockC.NO);
  }
});