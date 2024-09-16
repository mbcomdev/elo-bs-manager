/**
 * Extracts and Convert Eloinst-File to Git-Directory
 *
 * @author ELO Digital Office GmbH
 *
 * @elosh
 */

var EloConvertEloInstToGit;

EloConvertEloInstToGit = {

  /**
   * Returns the path of the parent
   * @param {java.io.File} path Path
   * @return {String}
   */
  getParentPath: function (path) {
    return String(new java.io.File(path + "").parent);
  },

  /**
   * Extracts the file name from a File without the file extension
   * @param {java.io.File} file
   * @return {java.lang.String} The name of the file without the file extension
   */
  getNameWithoutExtension: function (file) {
    var name, extIdx;

    name = file.getName();
    extIdx = name.lastIndexOf(".");
    if (extIdx < 0) {
      return name;
    }
    return name.substring(0, extIdx);
  },

  /**
   * Extracts the file extension from a File
   * @param {java.io.File} file
   * @return {java.lang.String} The file extension
   */
  getExtension: function (file) {
    var name, extIdx;
    name = file.getName();
    extIdx = name.lastIndexOf(".");
    if (extIdx < 0) {
      return "";
    }
    return name.substring(extIdx + 1, name.length());
  },

  /**
   * Reads a file into a string
   * @param {java.io.File} file
   * @param {String} encoding
   * @return {String}
   */
  readFileToString: function (file, encoding) {
    var _result;

    _result = String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, encoding ? encoding : "UTF-8"));
    return _result;
  },

  /**
   * Writes a string into a file
   * @param {java.io.File} file
   * @param {String} content Text content
   * @param {String} encoding
   */
  writeStringToFile: function (file, content, encoding) {

    content = content || "";
    Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, content, encoding ? encoding : "UTF-8");
  },


  /**
   * Rename a file
   * @param {String} path Path
   * @param {String} newName New file name
   * @return {java.io.File}
   */
  renameFile: function (path, newName) {
    var srcFile, dstFile;

    srcFile = new java.io.File(path + "");
    dstFile = new java.io.File(srcFile.parentFile.absolutePath + java.io.File.separator + newName + "");
    if (dstFile.exists()) {
      dstFile.delete();
    }
    Packages.org.apache.commons.io.FileUtils.moveFile(srcFile, dstFile);
    return dstFile;
  },

  /**
   * Rename a Directory
   * @param {String} dirPath Path
   * @param {String} newDirName New file name
   * @return {java.io.File}
   */
  renameDir: function (dirPath, newDirName) {
    var dir = new java.io.File(dirPath + ""),
        newDir;

    if (!dir.isDirectory()) {
      return dir;
    }

    newDir = new java.io.File(dir.getParent() + java.io.File.separator + newDirName);
    if (dir.renameTo(newDir)) {
      return newDir;
    }
    return dir;
  },

  /**
   * Unzips a zip file
   * @param {java.io.File} zipFile ZIP file path
   * @param {java.io.File} dstDir Destination directory
   */
  unzip: function (zipFile, dstDir) {
    var fileInputStream, zipInputStream, zipEntry, fileName, newFile,
        fileOutputStream;

    log.info("[ENTER] EloConvertEloInstToGit.unzip(" + zipFile + "," + dstDir + ")");

    if (!dstDir.exists()) {
      dstDir.mkdirs();
    }
    fileInputStream = new java.io.FileInputStream(zipFile);
    zipInputStream = new java.util.zip.ZipInputStream(fileInputStream);
    zipEntry = zipInputStream.nextEntry;
    while (zipEntry) {
      fileName = zipEntry.name;
      newFile = new java.io.File(dstDir.canonicalPath + java.io.File.separator + fileName + "");
      new java.io.File(newFile.parent + "").mkdirs();
      fileOutputStream = new java.io.FileOutputStream(newFile);
      Packages.org.apache.commons.io.IOUtils.copy(zipInputStream, fileOutputStream);
      fileOutputStream.close();
      zipInputStream.closeEntry();
      zipEntry = zipInputStream.nextEntry;
    }
    zipInputStream.closeEntry();
    zipInputStream.close();
    fileInputStream.close();

    log.info("[EXIT] EloConvertEloInstToGit.unzip(" + zipFile + "," + dstDir + ")");
  },

  /**
   * Lists all file of an directory
   * @param {java.io.File} packageDir Directory
   * @param {String[]} extensions Array of file extensions
   * @return {java.io.File[]} Files
   */
  listAllFiles: function (packageDir, extensions) {
    var packageFiles = [];

    if (!extensions) {
      packageFiles = Packages.org.apache.commons.io.FileUtils.listFiles(packageDir,
        Packages.org.apache.commons.io.filefilter.TrueFileFilter.INSTANCE,
        Packages.org.apache.commons.io.filefilter.TrueFileFilter.INSTANCE);

    } else {
      // packageFiles = Packages.org.apache.commons.io.FileUtils.listFiles(packageDir, extensions, true);
      packageFiles = Packages.org.apache.commons.io.FileUtils.listFiles(
        packageDir,
        new Packages.org.apache.commons.io.filefilter.SuffixFileFilter(extensions, Packages.org.apache.commons.io.IOCase.INSENSITIVE),
        Packages.org.apache.commons.io.filefilter.TrueFileFilter.INSTANCE
      );
      log.info("found files: " + packageDir + ", " + packageFiles);
    }
    return packageFiles;
  },

  /**
   * Walk recursively files
   * @param {String} path Directory path
   * @param {String[]} extensions Array of file extensions
   */
  walkFiles: function (path) {
    var me = this,
        root, list, i, f;

    root = new java.io.File(path + "");
    list = root.listFiles();

    if (list == null) {
      return;
    }

    for (i = 0; i < list.length; i++) {
      f = list[i];
      if (f.isDirectory()) {
        me.walkFiles(f.getAbsolutePath());
        log.debug("Dir:" + f.getAbsoluteFile());
      } else {
        log.debug("File:" + f.getAbsoluteFile());
      }
    }
  },

  /**
   * Get Description from es8-File
   * @param {java.io.File[]} list All files
   * @param {String} fname File name
   * @return {Object} Result
   */
  getDesc: function (list, fname) {
    var me = this,
        f, i, j, fnameEs8,
        strData, lines, res,
        desc, result;

    fnameEs8 = fname + ".es8";
    result = {};
    for (i = 0; i < list.length; i++) {
      f = list[i];
      if (f.getName() == fnameEs8) {
        strData = me.readFileToString(f);
        lines = strData.split("\n");
        for (j = 0; j < lines.length; j++) {
          res = lines[j].split("=");
          if (res[0] == "SHORTDESC") {
            desc = res[1] + "";
            desc = desc.split("\r")[0];
            if (desc.endsWith(".")) {
              desc = desc.substring(0, desc.length - 1) + "_";
            }
            desc = desc.replace(/[\/\?<>\\:\*\|":]/g, "_");
            result = {
              desc: desc
            };
          }
        }
      }
    }
    return result;
  },

  /**
   * Get DocExtension from es8-File
   * @param {java.io.File[]} list All files
   * @param {String} fname File name
   * @return {Object} Result
   */
  getExt: function (list, fname) {
    var me = this,
        f, i, j, fnameEs8,
        strData, lines, res,
        docExt, result;

    fnameEs8 = fname + ".es8";
    result = {};
    for (i = 0; i < list.length; i++) {
      f = list[i];
      if (f.getName() == fnameEs8) {
        strData = me.readFileToString(f);
        lines = strData.split("\n");
        for (j = 0; j < lines.length; j++) {
          res = lines[j].split("=");
          if (res[0] == "DOCEXT") {
            docExt = res[1];
            docExt = docExt.split("\r")[0];
            result = {
              docExt: docExt
            };
          }
        }
      }
    }
    return result;
  },

  /**
   * Rename all Sub-Directories and Files
   * @param {String} path Directory path
   */
  renameAllDirFiles: function (path) {
    var me = this,
        root, list, i, f,
        fdesc, fname, fext, result;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }

    for (i = 0; i < list.length; i++) {
      f = list[i];
      fname = me.getNameWithoutExtension(f);
      fext = me.getExtension(f);
      result = me.getDesc(list, fname);

      if (f.isDirectory()) {
        if (result.desc) {
          fdesc = result.desc;
          f = me.renameDir(f.getAbsolutePath(), fdesc);
        }
        log.debug("Dir:" + f.getAbsoluteFile());
      }

      if (f.isFile()) {
        if ((fext != "es8") && (fext != "ESW")) {
          if (result.desc) {
            fdesc = result.desc;
            f = me.renameFile(f.getAbsolutePath(), fdesc + "." + fext);
          }
        }
        log.debug("File:" + f.getAbsoluteFile());
      }
    }
  },

  /**
   * Remove all ESW-Files Files
   * @param {String} path Directory path
   */
  removeEswFiles: function (path) {
    var me = this,
        root, list, i, f,
        fext;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];
      fext = me.getExtension(f);
      if (fext == "ESW") {
        if (f.exists()) {
          f.delete();
        }
      }
    }
  },

  /**
   * Rename all es8-Files
   * @param {String} path Directory path
   */
  renameEs8Files: function (path) {
    var me = this,
        root, list, i, f,
        fdesc, fname, fext, result1, result2,
        docExt;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];
      fname = me.getNameWithoutExtension(f);
      fext = me.getExtension(f);
      result1 = me.getDesc(list, fname);
      result2 = me.getExt(list, fname);

      if (f.isFile()) {
        if ((fext == "es8")) {
          if (result1.desc) {
            fdesc = result1.desc;
            if (result2.docExt) {
              docExt = result2.docExt;
              f = me.renameFile(f.getAbsolutePath(), fdesc + "." + docExt + "." + fext);
            } else {
              f = me.renameFile(f.getAbsolutePath(), fdesc + "." + fext);
            }
          }
        }
        log.debug("File:" + f.getAbsoluteFile());
      }
    }
  },

  /**
   * Cleanup Childliste all es8-Files
   * @param {String} path Directory path
   */
  cleanupSubItemsEs8Files: function (path) {
    var me = this,
        root, list, i, j, f,
        fname, fext, res, line,
        strData, lines, clines,
        content, ignoreNext;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];
      fname = me.getNameWithoutExtension(f);
      fext = me.getExtension(f);

      if (f.isFile()) {
        if ((fext == "es8")) {
          strData = me.readFileToString(f);
          lines = strData.split("\n");

          clines = [];
          line = "";
          ignoreNext = false;
          for (j = 0; j < lines.length; j++) {
            if (!ignoreNext) {
              clines.push(lines[j]);
            }
            ignoreNext = false;

            res = lines[j].split("\r");
            line = res[0];
            if (line.indexOf("KEYKEY=BS_BUILD_NO") === 0) {
              clines.push("KEYTEXT=1");
              ignoreNext = true;
            }
            if (line.indexOf("KEYKEY=BS_VERSION_NO") === 0) {
              clines.push("KEYTEXT=GIT");
              ignoreNext = true;
            }
            if (line.indexOf("KEYKEY=BS_GIT") === 0) {
              clines.push("KEYTEXT=");
              ignoreNext = true;
            }
            if (line == "[SUBITEMS]") {
              break;
            }
          }
          if (line != "") {
            content = clines.join("\n");
            content += "\n";
            me.writeStringToFile(f, content);
          }
        }
        log.debug("File:" + f.getAbsoluteFile());
      }
    }
  },

  /**
   * Cleanup ExportInfo Subfiles Definitions
   * @param {String} path Directory path
   */
  cleanupExportInfoFiles: function (path) {
    var me = this,
        root, list, i, j, f,
        fname, fext, ignore, line,
        strData, lines, clines,
        content;

    log.info("Cleanup ini files... " + path);

    root = new java.io.File(path + "");
    list = me.listAllFiles(root, [".ini", ".exr"]);
    log.info("Found ini exr files: " + list);
    if (list == null) {
      return;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];
      fname = me.getNameWithoutExtension(f);
      fext = me.getExtension(f);

      if (f.isFile()) {
        if ((f.getName().equals("ExpInfo.ini"))) {
          log.info("Found Export Info root file...");
          strData = me.readFileToString(f, "UTF-16LE") + "";
          strData = strData.replace(/(,\d{4}.(0?[1-9]|1[012]).(0?[1-9]|[12][0-9]|3[02]).\d{2}.\d{2}.\d{2},)/gm, ",2017.01.01.12.00.00,");
          // for some reason exportInfo-files sometimes are not always \r\n. fixing this.
          strData = strData.replace(/\r/g, "");
          lines = strData.split("\n");

          clines = [];
          line = "";
          ignore = false;
          for (j = 0; j < lines.length; j++) {
            line = lines[j];
            if (line.indexOf("[") == 0) {
              ignore = false;
            }
            if (!ignore) {
              clines.push(lines[j]);
            }
            log.debug(line + "");
            if (line == "[SUBITEMS]") {
              log.debug("-- subfiles");
              clines.push("0=000007D1");
              ignore = true;
            }
          }
          content = clines.join("\n");
          content += "\n";

          // write as text-file since git doesn't support comparing ini files
          var fnew = new java.io.File((f.canonicalPath + "").replace("ExpInfo.ini", "ExpInfo.ini.txt"));
          Packages.org.apache.commons.io.FileUtils.deleteQuietly(f);
          me.writeStringToFile(fnew, content, "UTF-16LE");
        }

        if ((f.getName().equals("ExpRefs.exr"))) {
          log.info("Found Export References file...");
          me.writeStringToFile(f, "\n", "UTF-16LE");
        }

        log.debug("File:" + f.getAbsoluteFile());
      }
    }
  },

  /**
   * Format Workflow JSON-Objects files
   * @param {String} path Directory path
   */
  formatWorkflowJsonFiles: function (path) {
    var me = this,
        root, list, i, j, f,
        fname, fext, strData,
        content, workflowObj, obj;

    log.info("Format Workflow JSON-Object files... " + path);

    root = new java.io.File(path + "");
    if (root.exists()) {


      list = me.listAllFiles(root, [".json"]);
      log.info("Found json files: " + list);
      if (list == null) {
        return;
      }
      for (i = 0; i < list.length; i++) {
        f = list[i];
        fname = me.getNameWithoutExtension(f);
        fext = me.getExtension(f);

        if (f.isFile()) {
          log.info("Found Workflow JSON-Object file...");
          strData = me.readFileToString(f);

          // Parsing Workflow Object
          workflowObj = JSON.parse(strData);
          if (workflowObj.objectTable) {
            for (j = 0; j < workflowObj.objectTable.length; j++) {
              obj = workflowObj.objectTable[j];
              if (obj) {
                if (obj.tStamp) {
                  obj.tStamp = "2017.01.01.12.00.00";
                }
              }
            }
          }
          // Stringify JSON-Object with tab 2
          content = JSON.stringify(workflowObj, null, 2);
          me.writeStringToFile(f, content);
          log.debug("File: " + f.getAbsoluteFile());
        }
      }
    }
  },

  /**
   * Get all es8-Files
   * @param {String} path Directory path
   * @return {java.io.File[]} Files
   */
  getEs8Files: function (path) {
    var me = this,
        es8Files = [],
        root, list, i, f,
        fname, fext;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return es8Files;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];
      fname = me.getNameWithoutExtension(f);
      fext = me.getExtension(f);

      if (f.isFile()) {
        if ((fext == "es8")) {
          es8Files.push(f);
        }
        log.debug("File:" + f.getAbsoluteFile());
      }
    }
    return es8Files;
  },

  /**
   * Set DOCID and OBJID to 0 in es8 -File
   * @param {java.io.File} es8File es8-Files
   */
  initDocIdObjIdEs8File: function (es8File) {
    var me = this,
        fname, fext, key, j, res,
        strData, lines, clines, content;

    fname = me.getNameWithoutExtension(es8File);
    fext = me.getExtension(es8File);

    if (es8File.isFile()) {
      if ((fext == "es8")) {
        strData = me.readFileToString(es8File);
        lines = strData.split("\n");

        clines = [];
        for (j = 0; j < lines.length; j++) {
          res = lines[j].split("=");
          key = res[0];
          if ((key == "DOCID") || (key == "OBJID")) {
            lines[j] = "" + key + "=-1" + "\r";
          }
          if (key == "TSTAMP") {
            lines[j] = "" + key + "=2017.01.01.12.00.00" + "\r";
          }
          if (key == "ABLDATE") {
            lines[j] = "" + key + "=01.01.2017" + "\r";
          }
          if (key == "ABLDATEISO") {
            lines[j] = "" + key + "=20170101000000" + "\r";
          }
          if (key == "PATH" &&
              res[1].indexOf("0") !== 0) {
            // force all package related data to be in elosys path (id 2)
            // ignore folders typed with path 0
            lines[j] = "" + key + "=2" + "\r";
          }
          clines.push(lines[j]);
        }
        content = clines.join("\n");
        // content += "\n";
        me.writeStringToFile(es8File, content);

        log.debug("File:" + es8File.getAbsoluteFile());
      }
    }
  },

  /**
   * Set DOCID and OBJID to 0 in es8 -Files in Directory path
   * @param {String} path Directory path
   */
  initDocIdObjIdEs8Files: function (path) {
    var me = this,
        root, list, e, fes8, es8Files;

    // Get all es8-Files
    es8Files = me.getEs8Files(path);

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }

    for (e = 0; e < es8Files.length; e++) {
      fes8 = es8Files[e];
      me.initDocIdObjIdEs8File(fes8);
    }
  },

  /**
   * Convert EloArchvivnames recursively
   * @param {String} path Directory path
   */
  convertEloArchiv: function (path) {
    var me = this,
        root, list, i, f;

    // Rename all Directories und Files
    me.renameAllDirFiles(path);

    // Remove ESW Files
    me.removeEswFiles(path);

    // Rename es8-Files
    me.renameEs8Files(path);

    // Cleanup Childliste es8 - Files
    me.cleanupSubItemsEs8Files(path);

    // Subdirectories
    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }

    for (i = 0; i < list.length; i++) {
      f = list[i];
      if (f.isDirectory()) {
        me.convertEloArchiv(f.getAbsolutePath());
      }
    }

    // Generate Childliste es8 - Files of Directories
    me.initDocIdObjIdEs8Files(path);
  },

  /**
   * Start Converting Eloinst-File
   * @param {String} eloinstFileName Elo inst file
   * @param {String} gitDirName Git-Directory
   */
  execute: function (eloinstFileName, gitDirName) {
    var me = this,
        gitDir, lfiles, i, subdir, filename;

    if (!eloinstFileName || !gitDirName) {
      print("Usage: EloConvertToGit [eloinstFile.eloinst] [gitDir] ");
      return;
    }

    log.info("[ENTER] EloConvertEloInstToGit.execute(): eloinstFileName=" + eloinstFileName);

    eloinstFileName = eloinstFileName.trim();
    gitDirName = gitDirName.trim();

    try {
      // Clear gitDirName
      gitDir = new java.io.File(gitDirName + "");
      Packages.org.apache.commons.io.FileUtils.deleteQuietly(gitDir);
      Packages.org.apache.commons.io.FileUtils.forceMkdir(gitDir);

      me.unzip(eloinstFileName, gitDir);

      lfiles = me.listAllFiles(gitDir, [".zip"]);

      for (i = 0; i < lfiles.length; i++) {
        log.debug("[" + i + "]: " + lfiles[i]);

        // unzip ELO-Archiv files
        filename = lfiles[i];
        filename = me.getNameWithoutExtension(lfiles[i]);
        subdir = me.getParentPath(lfiles[i]);
        subdir = subdir + java.io.File.separator + filename;
        subdir = new java.io.File(subdir + "");
        Packages.org.apache.commons.io.FileUtils.forceMkdir(subdir);
        me.unzip(lfiles[i], subdir);
        Packages.org.apache.commons.io.FileUtils.deleteQuietly(lfiles[i]);
      }

      log.info("current path is: " + subdir);
      me.convertEloArchiv(subdir);

      // Cleanup Childliste es8 - Files
      me.cleanupExportInfoFiles(subdir);

      // Format Workflow JSON-Objects
      log.info("subdir:" + subdir);
      subdir = me.getParentPath(subdir);
      log.info("getParentPath(subdir):" + subdir);
      subdir = subdir + java.io.File.separator + "workflowTemplates";
      log.info("subdir workflowTemplates:" + subdir);
      me.formatWorkflowJsonFiles(subdir);

      log.info("[EXIT] EloConvertEloInstToGit.execute(): eloinstFileName=" + eloinstFileName);
    } catch (err) {
      log.error("[EXCEPTION] EloConvertEloInstToGit.execute(): error=" + err.message);
    }
  }
};

EloConvertEloInstToGit.execute($ARGS[0], $ARGS[1]);
