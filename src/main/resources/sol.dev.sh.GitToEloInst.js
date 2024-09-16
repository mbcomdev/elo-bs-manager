
//@include lib_Class.js
//@include lib_sol.common.FileUtils.js
//@include lib_sol.common.ObjectUtils.js
//@include lib_sol.common.ExceptionUtils.js

/**
 * Convert and Compress Git-Directory to Eloinst-File
 *
 * @author ELO Digital Office GmbH
 *
 * @elosh
 */

var EloConvertGitToEloInst;

EloConvertGitToEloInst = {

  eloCounter: 2000,

  /**
   * Returns the path of the parent
   * @param {java.io.File} path Path
   * @return {String}
   */
  getParentPath: function (path) {
    var file, parentPath;
    file = new java.io.File(path + "");
    parentPath = file.getParent();
    return parentPath;
  },

  /**
   * Extracts the file name from a File without the file extension
   * @param {java.io.File} file
   * @return {java.lang.String} The name of the file without the file extension
   */
  getNameWithoutExtension: function (file) {
    var name, extIdx;

    name = file.getName();
    if (file.isDirectory()) {
      return name;
    }
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
    if (file.isDirectory()) {
      return "";
    }
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

    srcFile = new java.io.File(path);
    dstFile = new java.io.File(srcFile.parentFile.absolutePath + java.io.File.separator + newName);
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

    newDir = new java.io.File(dir.getParent() + "/" + newDirName);
    if (dir.renameTo(newDir)) {
      return newDir;
    } else {
      // TODO The building process should be aborted, if renaming cannot happen
      // so building tools like gradle could failure
      log.error("Could not rename dir = " + dir)
    }
    return dir;
  },

  /**
   * Pads a string at the left side
   * @param {String|Number} str Input string
   * @param {Number} length Destination length of the string
   * @param {String} [padString="0"] (optional) Padding string
   * @return {String} Padded string
   */
  padLeft: function (str, length, padString) {
    str += "";
    padString = padString || "0";
    while (str.length < length) {
      str = padString + str;
    }
    return str;
  },

  /**
   * Pads a string at the right side
   * @param {String|Number} str Input string
   * @param {Number} length Destination length of the string
   * @param {String} [padString="0"] (optional) Padding string
   * @return {String} Padded string
   */
  padRight: function (str, length, padString) {
    str += "";
    padString = padString || "0";
    while (str.length < length) {
      str += padString;
    }
    return str;
  },

  /**
   * Compresses a local folder into a ZIP file
   * @param {java.io.File} folder Source folder
   * @param {java.io.File} zipFile Compressed file
   */
  zipFolder: function (folder, zipFile) {
    var me = this,
        fileOutputStream, zipOutputStream;

    fileOutputStream = new java.io.FileOutputStream(zipFile);
    zipOutputStream = new java.util.zip.ZipOutputStream(fileOutputStream);
    me.compressFolder(folder, zipOutputStream, folder.path.length() + 1);
    zipOutputStream.close();
    fileOutputStream.close();
    zipOutputStream.close();
    fileOutputStream.close();
  },

  /**
   * @private
   * Recursive function that compresses a sub folder
   * @param {java.io.File} folder Folder
   * @param {java.io.OutputStream} zipOutputStream
   * @param {Number} prefixLength Length of the path part
   */
  compressFolder: function (folder, zipOutputStream, prefixLength) {
    var me = this,
        file, files, i, fileInputStream, zipEntryName;

    files = folder.listFiles();
    for (i = 0; i < files.length; i++) {
      file = files[i];
      if (file.isFile()) {
        zipEntryName = String(file.path.substring(prefixLength)).replace(/\\/g, "/");
        log.debug("ZIP : " + zipEntryName);
        zipOutputStream.putNextEntry(new java.util.zip.ZipEntry(zipEntryName));
        try {
          fileInputStream = new java.io.FileInputStream(file);
          Packages.org.apache.commons.io.IOUtils.copy(fileInputStream, zipOutputStream);
        } catch (ex) {
          log.error("Zip output stream failed: " + ex);
          // ignore
        } finally {
          if (fileInputStream) {
            fileInputStream.close();
            zipOutputStream.closeEntry();
          }
        }
      } else if (file.isDirectory()) {
        me.compressFolder(file, zipOutputStream, prefixLength);
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
        fext;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return es8Files;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];
      fext = me.getExtension(f);
      if (f.isFile()) {
        if ((fext == "es8")) {
          es8Files.push(f);
        }
      }
    }
    return es8Files;
  },

  hexCache: {},

  /**
   * Generate new elo number in hex format
   * @return {String} Hex value of elo number
   */
  getNewEloNumber: function () {
    var me = this,
        hex;

    me.eloCounter += 1;
    hex = me.eloCounter.toString(16);
    hex = me.padLeft(hex, 8, "0");
    hex = hex.toUpperCase();

    me.hexCache[hex] = Number(me.eloCounter);

    return hex;
  },

  /**
   * Rename all Sub-Directories and Files to numbers
   * @param {java.io.File[]} es8Files Files
   * @param {String} path Directory path
   */
  renameAllDirFilesToNumbers: function (es8Files, path) { // NOSONAR
    var me = this,
        root, list, e, fes8, fes8name, eloNumberHex,
        f, i, fname, fext;

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }

    for (e = 0; e < es8Files.length; e++) {
      fes8 = es8Files[e];
      fes8name = me.getNameWithoutExtension(fes8);
      eloNumberHex = me.getNewEloNumber();

      for (i = 0; i < list.length; i++) {
        f = list[i];
        fname = me.getNameWithoutExtension(f);
        fext = me.getExtension(f);
        if (fname == fes8name) {
          if (f.isDirectory()) {
            if (fname != eloNumberHex) {
              f = me.renameDir(f.getAbsolutePath(), eloNumberHex);
            }
          }

          if (f.isFile()) {
            if (fname != eloNumberHex) {
              f = me.renameFile(f.getAbsolutePath(), eloNumberHex + "." + fext);
            }
          }

        }
        if (fext != "es8") {
          if (f.getName() == fes8name) {
            if (f.isFile()) {
              f = me.renameFile(f.getAbsolutePath(), eloNumberHex + "." + fext);
            }
          }
        }
      }
    }
  },

  /**
   * Create Childliste es8-File with es8-Files from Subitems
   * @param {java.io.File} es8File es8-Files
   * @param {java.io.File[]} es8SubItemsFiles es-Files from Subitems
   */
  processEs8File: function (es8File, es8SubItemsFiles, gitVersion, gitHash) { // NOSONAR
    var me = this,
        fext, line, j,
        strData, lines, clinesEs8, contentEs8,
        es8SubItemsFile, es8SubItemsName, ignoreNext;

    fext = me.getExtension(es8File);
    if (es8File.isFile()) {
      if ((fext == "es8")) {
        strData = me.readFileToString(es8File);
        strData = strData.replace(/\r/g, "");
        lines = strData.split("\n");

        clinesEs8 = [];
        line = "";
        ignoreNext = false;
        for (j = 0; j < lines.length; j++) {
          if (String(lines[j]).indexOf("OBJID=") === 0) {
            clinesEs8.push("OBJID=" + me.hexCache[me.getNameWithoutExtension(es8File)]);
          } else if (!ignoreNext) {
            clinesEs8.push(lines[j]);
          }
          ignoreNext = false;
          if (lines[j] == "[SUBITEMS]"
            && es8SubItemsFiles.length > 0) {
            break;
          }
          if (lines[j].indexOf("KEYKEY=BS_VERSION_NO") === 0) {
            clinesEs8.push("KEYTEXT=" + gitVersion);
            log.info("Found BS_VERSION_NO key in es8. Replacing with: " + gitVersion);
            ignoreNext = true;
          }
          if (lines[j].indexOf("KEYKEY=BS_GIT") === 0) {
            clinesEs8.push("KEYTEXT=" + gitHash);
            log.info("Found BS_GIT key in es8. Replacing with: " + gitHash);
            ignoreNext = true;
          }
        }
        if (lines[j] != "[SUBITEMS]"
          && es8SubItemsFiles.length > 0) {
          clinesEs8.push("[SUBITEMS]");
        }
        if (es8SubItemsFiles.length > 0) {
          for (j = 0; j < es8SubItemsFiles.length; j++) {
            es8SubItemsFile = es8SubItemsFiles[j];
            es8SubItemsName = me.getNameWithoutExtension(es8SubItemsFile);
            line = "" + j + "=" + es8SubItemsName;
            clinesEs8.push(line);
          }
        }
        contentEs8 = clinesEs8.join("\r\n");
        me.writeStringToFile(es8File, contentEs8);
      }
    }
  },

  /**
   * Generate Childliste es8 - Files of Directories
   * @param {String} path Directory path
   */
  generateSubItemsEs8Files: function (path, gitVersion, gitHash) {
    var me = this,
        root, list, e, fes8, fes8name, es8Files,
        es8SubItemsFiles, f, i, fname;

    // Get all es8-Files
    es8Files = me.getEs8Files(path);

    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }

    for (e = 0; e < es8Files.length; e++) {
      fes8 = es8Files[e];
      fes8name = me.getNameWithoutExtension(fes8);

      for (i = 0; i < list.length; i++) {
        f = list[i];
        fname = me.getNameWithoutExtension(f);

        if (fname == fes8name) {

          // Get es8 - Files from Subelements
          es8SubItemsFiles = [];
          if (f.isDirectory()) {
            es8SubItemsFiles = me.getEs8Files(f.getAbsolutePath());
            log.debug("Dir : " + f.getAbsoluteFile());
          } else {
            log.debug("File: " + f.getAbsoluteFile());
          }
          // Update es8 - File with es8 - Files form Subelements
          me.processEs8File(fes8, es8SubItemsFiles, gitVersion, gitHash);
        }
      }
    }
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
   * Process ExportInfo Subfiles Definitions
   * @param {String} path Directory path
   */
  processExportInfoFiles: function (path) {
    var me = this,
        root, list, i, f,
        strData, fnewName, fnew;

    log.info("Process renamed ini files... " + path);

    root = new java.io.File(path + "");
    list = me.listAllFiles(root, [".txt"]);
    log.info("Found ini exr files: " + list);
    if (list == null) {
      return;
    }
    for (i = 0; i < list.length; i++) {
      f = list[i];

      if (f.isFile()) {
        if ((f.getName().equals("ExpInfo.ini.txt"))) {
          log.info("Found Export Info root file...");
          strData = me.readFileToString(f, "UTF-16LE");

          // write as text-file since git doesn't support comparing ini files
          fnewName = f.canonicalPath.replace("ExpInfo.ini.txt", "ExpInfo.ini");
          fnew = new java.io.File(fnewName + "");
          Packages.org.apache.commons.io.FileUtils.deleteQuietly(f);
          me.writeStringToFile(fnew, strData, "UTF-16LE");
        }

        log.debug("File:" + f.getAbsoluteFile());
      }

    }
  },

  /**
   * Convert Git Directory recursively
   * @param {String} path Directory path
   */
  convertGitDir: function (path, gitVersion, gitHash) {
    var me = this,
        root, list, i, f,
        es8Files;

    // Get all es8-Files
    es8Files = me.getEs8Files(path);

    // Rename all Directories und Files to numbers
    me.renameAllDirFilesToNumbers(es8Files, path);

    // Subdirectories
    root = new java.io.File(path + "");
    list = root.listFiles();
    if (list == null) {
      return;
    }

    for (i = 0; i < list.length; i++) {
      f = list[i];
      if (f.isDirectory()) {
        me.convertGitDir(f.getAbsolutePath());
      }
    }

    // Generate Childliste es8 - Files of Directories
    me.generateSubItemsEs8Files(path, gitVersion, gitHash);

  },

  /**
   * Get RepoData path from Git Directory
   * @param {String} gitDirName Git Directory name
   * @return {String} RepoData path
   */
  getRepoDataPath: function (gitDirName, relativePathToRepoData) {
    var dir, repoDataPath;

    repoDataPath = gitDirName + relativePathToRepoData;
    dir = new java.io.File(repoDataPath + "");

    if (dir.exists()) {
      return repoDataPath;
    }

    throw new Error("'" + repoDataPath + "' does not exist");
  },

  /**
   * Start Converting Git-Directory
   * @param {String} gitDirName Git-Directory
   * @param {String} eloinstFileName Elo inst file
   * @param {String} eloinstworkdir Elo inst working directory
   * @param {String} gitVersion current version of the git project
   * @param {String} gitHash current commit hash of the git project
   * @param {String} repoDataPath relative path to repoData folder. If it is not set default is "/install.data/RepoData"
   */
  execute: function (gitDirName, eloinstFileName, eloinstworkdir, gitVersion, gitHash, repoDataPath) {
    var me = this,
        repoDataPath,
        tempFile, backupDir, repoDataFolder, repoDataZip,
        gitDir, eloinstFile, exceptionString;

    //log.info("EloConvertGitToEloInst: gitDirName={}, eloinstFileName={}, eloinstworkdir={}, gitVersion={}, gitHash={}, repoDataPath={}", gitDirName, eloinstFileName, eloinstworkdir, gitVersion, gitHash, repoDataPath);

    if (!gitDirName || !eloinstFileName || !eloinstworkdir || !gitVersion || !gitHash) {
      print("Usage: GitConvertToElo [gitDirName] [eloinstFileName] [eloinstworkdir] [gitVersion] [gitHash]");
      return;
    }

    if (!gitVersion) {
      gitVersion = "nightly";
    }

    eloinstFileName = eloinstFileName.trim();
    gitDirName = gitDirName.replace("\"", "").trim();
    eloinstworkdir = eloinstworkdir.replace("\"", "").trim();

    try {
      // save Git to backup
      backupDir = eloinstworkdir;
      backupDir = new java.io.File(backupDir + "");
      Packages.org.apache.commons.io.FileUtils.deleteQuietly(backupDir);
      Packages.org.apache.commons.io.FileUtils.forceMkdir(backupDir);

      log.info("copyDirectory: source=" + gitDirName + ", backupDir=" + backupDir.absolutePath);
      Packages.org.apache.commons.io.FileUtils.copyDirectory(new java.io.File(gitDirName), backupDir);
      log.info("prepared backup path: " + backupDir.absolutePath);

      // Clear eloinstFileName
      tempFile = new java.io.File(eloinstFileName + "");
      Packages.org.apache.commons.io.FileUtils.deleteQuietly(tempFile);

      // Get RepoData Directory
      repoDataPath = me.getRepoDataPath(backupDir, repoDataPath || "/install.data/RepoData");
      me.convertGitDir(repoDataPath, gitVersion, gitHash);
      me.processExportInfoFiles(repoDataPath);

      // zip files
      repoDataFolder = new java.io.File(repoDataPath + "");
      repoDataZip = me.getParentPath(repoDataFolder) + "/RepoData.zip";
      repoDataZip = new java.io.File(repoDataZip + "");

      Packages.org.apache.commons.io.FileUtils.deleteQuietly(repoDataZip);
      me.zipFolder(repoDataFolder, repoDataZip);
      Packages.org.apache.commons.io.FileUtils.deleteQuietly(repoDataFolder);

      gitDir = new java.io.File(backupDir + "");
      eloinstFile = new java.io.File(eloinstFileName + "");
      me.zipFolder(gitDir, eloinstFile);

      Packages.org.apache.commons.io.FileUtils.deleteQuietly(backupDir);

      log.info("[EXIT] EloConvertGitToEloInst.execute(" + repoDataPath + ")");
    } catch (ex) {
      log.error("[EXCEPTION] EloConvertGitToEloInst exception: ", ex);
      log.info("ex.toString()" + ex.toString());
      exceptionString = sol.common.ExceptionUtils.parseException(ex);
      log.info("exceptionString=" + exceptionString);
    }
  }
};

EloConvertGitToEloInst.execute($ARGS[0], $ARGS[1], $ARGS[2], $ARGS[3], $ARGS[4], $ARGS[5]);