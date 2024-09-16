/**
 * Checksum Eloinst
 * 
 * @author JHR, ELO Digital Office GmbH
 * @version 1.01.002
 *
 * @elosh
 */ 

var CheckSumEloInst;

CheckSumEloInst = {

  /**
   * Returns the path of the parent
   * @param {java.io.File} path Path
   * @return {String}
   */
  getParentPath: function (path) {
    return String(new File(path).parent);
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
   * Unzips a zip file
   * @param {java.io.File} zipFile ZIP file path
   * @param {java.io.File} dstDir Destination directory
   */
  unzip: function (zipFile, dstDir) {
    var fileInputStream, zipInputStream, zipEntry, fileName, newFile,
        fileOutputStream;

    log.info("[ENTER] CheckSumEloInst.unzip(" + zipFile + "," + dstDir + ")");
    
    if (!dstDir.exists()) {
      dstDir.mkdirs();
    }
    fileInputStream = new java.io.FileInputStream(zipFile);
    zipInputStream = new java.util.zip.ZipInputStream(fileInputStream);
    zipEntry = zipInputStream.nextEntry;
    while (zipEntry) {
      fileName = zipEntry.name;
      newFile = new java.io.File(dstDir.canonicalPath + File.separator + fileName);
      new java.io.File(newFile.parent).mkdirs();
      fileOutputStream = new FileOutputStream(newFile);
      Packages.org.apache.commons.io.IOUtils.copy(zipInputStream, fileOutputStream);
      fileOutputStream.close();
      zipInputStream.closeEntry();
      zipEntry = zipInputStream.nextEntry;
    }
    zipInputStream.closeEntry();
    zipInputStream.close();
    fileInputStream.close();
    
    log.info("[EXIT] CheckSumEloInst.unzip(" + zipFile + "," + dstDir + ")");
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
      packageFiles = Packages.org.apache.commons.io.FileUtils.listFiles(packageDir, extensions, true);          
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

    root = new java.io.File(path);
    list = root.listFiles();

    if (list == null) {
      return;
    }

    for (i = 0; i < list.length; i++) {
      f = list[i];
      if (f.isDirectory()) {
        me.walkFiles(f.getAbsolutePath());
        log.info("Dir:" + f.getAbsoluteFile());
      } else {
        log.info("File:" + f.getAbsoluteFile());
      }        
    }
  },
  
  /**
   * Calculate CRC32-Checksums and Total sum of all ZipEntries
   * @param {String} zipPath Directory path
   */
  getCRC32Sum: function (zipPath) {    
    var zipFile = null,
        totalCRC = 0,    
        e, entry, entryName, crc; 

    try {
      // open a zip file for reading
      zipFile = new java.util.zip.ZipFile(zipPath);
      
      // get an enumeration of the ZIP file entries
      e = zipFile.entries();
      while (e.hasMoreElements()) {
        entry = e.nextElement();
        
        // get the name of the entry
        entryName = entry.getName();
        
        // get the CRC-32 checksum of the uncompressed entry data, or -1 if not known
        crc = entry.getCrc();
        log.info(entryName + " with CRC-32: " + crc);
        totalCRC += crc;
      }
    } catch (ioe) {
      log.info("Error opening zip file" + ioe);
    } finally {
      try {
        if (zipFile != null) {
          zipFile.close();
        }
        log.info(" Totalsum CRC-32: " + totalCRC);        
      } catch (ioe) {
        log.info("Error while closing zip file" + ioe);
      }      
    }
  },  
  
  /**
   * Start Calculation CRC32-Checksum of 
   * @param {String} eloinstFileName Elo inst file
   * @param {String} tempDirName Temp Directory
   */
  execute: function (eloinstFileName, tempDirName) {
    var me = this,
        tempDir, lfiles, i, filename, subdir;
    
    if (!$ARG || ($ARG.length < 3)) {
      print("Usage: CheckSumEloInst [eloinstFile.eloinst] [tempDir] ");
      return; 
    }

    try {
      log.info("[ENTER] CheckSumEloInst.execute(" + eloinstFileName + ", " + tempDirName + ")");

      // Clear tempDirName
      tempDir = new java.io.File(tempDirName);    
      Packages.org.apache.commons.io.FileUtils.deleteQuietly(tempDir);
      Packages.org.apache.commons.io.FileUtils.forceMkdir(tempDir);   

      me.unzip(eloinstFileName, tempDir);

      lfiles = me.listAllFiles(tempDir, ["zip"]);

      for (i = 0; i < lfiles.length; i++) {
        log.info ("[" + i + "]: " + lfiles[i]);      

        // unzip ELO-Archiv files
        filename = lfiles[i];
        filename = me.getNameWithoutExtension(lfiles[i]);
        subdir = me.getParentPath(lfiles[i]);
        subdir = subdir + java.io.File.separator + filename;
        subdir = new java.io.File(subdir);
        Packages.org.apache.commons.io.FileUtils.forceMkdir(subdir);         
        // me.unzip(lfiles[i], subdir);   
        me.getCRC32Sum(lfiles[i]);            
        // Packages.org.apache.commons.io.FileUtils.deleteQuietly(lfiles[i]);
      }


      log.info("[EXIT] CheckSumEloInst.execute(" + eloinstFileName + ")");
    } catch (err) {
      log.error("[EXCEPTION] CheckSumEloInst.execute(" + eloinstFileName + ") err.message: " + err.message);
    }

    
  }
  
};

CheckSumEloInst.execute($ARG[1], $ARG[2]);
