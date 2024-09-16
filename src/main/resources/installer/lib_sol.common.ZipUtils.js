
importPackage(java.io);
importPackage(java.util.zip);

//@include lib_Class.js

/**
 * Utility functions for ZIP files
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 * @eloas
 * @eloix
 */
sol.define("sol.common.ZipUtils", {
  singleton: true,

  /**
   * Compresses a local folder into a ZIP file
   * @param {java.io.File} folder Source folder
   * @param {java.io.File} zipFile Compressed file
   */
  zipFolder: function (folder, zipFile) {
    var me = this,
        fileOutputStream, zipOutputStream;
    try {
      fileOutputStream = new FileOutputStream(zipFile);
      zipOutputStream = new ZipOutputStream(fileOutputStream);
      me.compressFolder(folder, zipOutputStream, folder.path.length() + 1);
      zipOutputStream.close();
      fileOutputStream.close();
    } catch (ex) {  // eslint-disable-line no-useless-catch
      throw ex;
    } finally {
      if (zipOutputStream) {
        zipOutputStream.close();
      }
      if (fileOutputStream) {
        fileOutputStream.close();
      }
    }
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
        zipEntryName = file.path.substring(prefixLength).replace(File.separatorChar, "/");
        zipOutputStream.putNextEntry(new ZipEntry(zipEntryName));
        try {
          fileInputStream = new FileInputStream(file);
          Packages.org.apache.commons.io.IOUtils.copy(fileInputStream, zipOutputStream);
        } catch (ignore) {
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
   * Unzips a zip file
   * @param {java.io.File} zipFile ZIP file path
   * @param {java.io.File} dstDir Destination directory
   * @param {Object} params Parameters
   * @param {String} [params.charset=UTF-8] Charset
   */
  unzip: function (zipFile, dstDir, params) {
    var charsetObj, fileInputStream, zipInputStream, zipEntry, fileName, newFile, fileOutputStream;

    if (!zipFile) {
      throw "'zipFile' is missing";
    }

    if (!dstDir) {
      throw "'dstDir' is missing";
    }

    params = params || {};
    params.charset = params.charset || "UTF-8";

    charsetObj = Packages.java.nio.charset.Charset.forName(params.charset);

    if (!zipFile.exists()) {
      throw "Zip file does not exist: zipFile=" + zipFile.absolutePath;
    }

    if (!dstDir.exists()) {
      dstDir.mkdirs();
    }
    fileInputStream = new java.io.FileInputStream(zipFile);
    zipInputStream = new java.util.zip.ZipInputStream(fileInputStream, charsetObj);
    zipEntry = zipInputStream.nextEntry;
    while (zipEntry) {
      fileName = zipEntry.name;
      newFile = new java.io.File(dstDir.canonicalPath + File.separator + fileName);
      new java.io.File(newFile.parent).mkdirs();
      if (!zipEntry.isDirectory()) {
        fileOutputStream = new FileOutputStream(newFile);
        Packages.org.apache.commons.io.IOUtils.copy(zipInputStream, fileOutputStream);
        fileOutputStream.close();
      }
      zipInputStream.closeEntry();
      zipEntry = zipInputStream.nextEntry;
    }
    zipInputStream.closeEntry();
    zipInputStream.close();
    fileInputStream.close();
  },

  bom: "\uFEFF",

  /**
   * Returns the text content of a file within a zip file
   * @param {String} zipFilePath Zip file path
   * @param {String} pathInZipFile Path in zip file
   * @param {Object} params Parameters
   * @param {String} [params.encoding=UTF-8] Encoding
   * @return {String} String
   */
  readFileInZipToString: function (zipFilePath, pathInZipFile, params) {
    var me = this,
        byteArray, javaString, text;

    params = params || {};
    params.encoding = params.encoding || "UTF-8";

    byteArray = me.readFileInZipToByteArray(zipFilePath, pathInZipFile);

    javaString = new java.lang.String(byteArray, params.encoding);
    if (javaString.startsWith(me.bom)) {
      javaString = javaString.substring(1);
    }

    text = javaString + "";

    return text;
  },

  /**
   * Returns the content of a file within a zip file as byte array
   * @param {String} zipFilePath Zip file path
   * @param {String} pathInZipFile Path in zip file
   * @return {java.lang.Byte[]} Bytes
   */
  readFileInZipToByteArray: function (zipFilePath, pathInZipFile) {
    var zipPathObj, zipFileSystem, srcFilePathObj, byteArray, stringClass, stringArr;

    if (!zipFilePath) {
      throw "'zipFilePath' is missing";
    }

    if (!pathInZipFile) {
      throw "'pathInZipFile is missing'";
    }

    zipPathObj = java.nio.file.Paths.get(zipFilePath);

    zipFileSystem = java.nio.file.FileSystems.newFileSystem(zipPathObj, java.lang.ClassLoader.systemClassLoader);

    stringClass = java.lang.Class.forName("java.lang.String");
    stringArr = java.lang.reflect.Array.newInstance(stringClass, 0);

    srcFilePathObj = zipFileSystem.getPath(pathInZipFile, stringArr);
    byteArray = java.nio.file.Files.readAllBytes(srcFilePathObj);
    zipFileSystem.close();

    return byteArray;
  },

  /**
   * Delete files in a folder within a ZIP file
   * @param {String} zipFilePath ZIP file path
   * @param {Object} params Parameters
   * @param {String} [params.encoding=UTF-8] Encoding of the ZIP file
   * @param {String} [params.startFolderPathInZipFile] Start folder Path in ZIP file
   * @param {String} [params.fileNamePattern=*.*] File name pattern
   * @param {Array} params.keepFileNames File names to be kept
   */
  deleteFilesInZipFileFolder: function (zipFilePath, params) {
    var zipFile, zipFileUriString, zipFileSystemProps, zipFileUri, zipFileSystem, pathMatcher, deletePath;

    if (!zipFilePath) {
      throw "'zipFilePath' is missing";
    }

    params = params || {};
    params.encoding = params.encoding || "UTF-8";
    params.startFolderPathInZipFile = params.startFolderPathInZipFile || "/";
    params.fileNamePattern = params.fileNamePattern || "*.*";
    params.keepFileNames = params.keepFileNames || [];

    zipFileSystemProps = {
      create: "false",
      encoding: "UTF-8"
    };

    zipFile = new java.io.File(zipFilePath);
    zipFileUriString = zipFile.toURI().toURL().toExternalForm();
    zipFileUri = java.net.URI.create("jar:" + zipFileUriString);
    zipFileSystem = java.nio.file.FileSystems.newFileSystem(zipFileUri, zipFileSystemProps);
    deletePath = zipFileSystem.getPath(params.startFolderPathInZipFile);
    if (java.nio.file.Files.exists(deletePath)) {
      pathMatcher = java.nio.file.FileSystems.default.getPathMatcher("glob:" + params.fileNamePattern);
      java.nio.file.Files.walkFileTree(deletePath, new JavaAdapter(java.nio.file.SimpleFileVisitor, {
        visitFile: function (path, basicFileAttributes) {
          if (pathMatcher.matches(path.fileName) && (params.keepFileNames.indexOf(path.fileName + "") < 0)) {
            java.nio.file.Files.delete(path);
          }
          return java.nio.file.FileVisitResult.CONTINUE;
        }
      }));
    }
    zipFileSystem.close();
  },

  /**
   * Returns if the file path exists in the zip file
   * @param {String} zipFilePath Zip file path
   * @param {String} pathInZipFile Path in zip file
   * @return Boolean
   */
  existsFilePathInZip: function (zipFilePath, pathInZipFile) {

    var fileInputStream, zipInputStream, zipEntry,
        pathInZipFileExists = false;

    if (!zipFilePath) {
      throw "'zipFilePath' is missing";
    }

    if (!pathInZipFile) {
      throw "'pathInZipFile' is missing";
    }

    fileInputStream = new java.io.FileInputStream(zipFilePath);
    zipInputStream = new java.util.zip.ZipInputStream(fileInputStream);

    zipEntry = zipInputStream.getNextEntry();
    while (zipEntry != null) {
      if (zipEntry.name == pathInZipFile) {
        pathInZipFileExists = true;
        break;
      }
      zipEntry = zipInputStream.getNextEntry();
    }

    zipInputStream.closeEntry();
    zipInputStream.close();
    fileInputStream.close();

    return pathInZipFileExists;
  }
});
