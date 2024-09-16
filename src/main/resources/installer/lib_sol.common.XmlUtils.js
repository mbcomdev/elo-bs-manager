
//@include lib_Class.js

/**
 * XML Builder
 *
 * @author Michael Weiler, ELO Digital Office GmbH
 * @version 1.0
 *
 * 
 * @eloas
 * @eloix
 */
sol.define("sol.common.XmlUtils", {

  singleton: true,

  /**
   * Converts a JavaScript object to a XML document
   * @param {Object} data Data object that contains the data that should be converted into XML
   * @param {Object} dataDefinition Definition object that contains meta information for the transformation.
   * @return {org.w3c.dom.Document} XML document
   *
   * ## Example
   *
   *    // Each array element of the "ChildSordDataCollector" array should be converted
   *    //   to tags with the tag name "Sord"
   *    var dataDefinition = {
   *      ChildSordDataCollector: "Sord"
   *    }
   *    var xmlDoc = sol.common.XmlUtils.convertObjectToXml({
   *      ChildSordDataCollector: [{
   *        name: "Sord1"
   *      } , {
   *        name: "Sord2"
   *      }]
   *    }, dataDefintion);
   *    XML result:
   *      <ChildSordDataCollector>
   *        <Sord>
   *          <name>Sord1</name>
   *        </Sord>#
   *        <Sord>
   *          <name>Sord2</name>
   *        </Sord>
   *      </ChildSordDataCollector>
   */
  convertObjectToXml: function (data, dataDefinition) {
    var xmlBuilder;
    xmlBuilder = sol.create("sol.common.XmlBuilder", {});
    xmlBuilder.buildFromJson(data, dataDefinition);
    return xmlBuilder.getXmlDoc();
  },

  /**
   * Returns the string representation of a XML document
   * @param {org.w3c.dom.Document} xmlDoc XML document
   * @return {String} String representation
   */
  toString: function (xmlDoc) {
    var xmlBuilder = sol.create("sol.common.XmlBuilder", { xmlDoc: xmlDoc });
    return xmlBuilder.toString();
  },

  /**
   * Reads a XML file
   * @param {String} xmlFilePath XML file path
   * @param {Object} params Parameters
   * @param {Boolean} [params.namespaceAware=false] Namespace aware
   * @return  {org.w3c.dom.Document} XML document
   */
  readXmlFile: function (xmlFilePath, params) {
    var xmlFile, documentBuilderFactory, documentBuilder, xmlDoc;
    if (!xmlFilePath) {
      throw "File path is empty";
    }

    params = params || {};

    xmlFile = new File(xmlFilePath);
    documentBuilderFactory = Packages.javax.xml.parsers.DocumentBuilderFactory.newInstance();

    //to prevent XXE attacks we completely disbale DTDs
    documentBuilderFactory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    documentBuilderFactory.setXIncludeAware(false);

    if (params.namespaceAware) {
      documentBuilderFactory.namespaceAware = true;
    }
    documentBuilder = documentBuilderFactory.newDocumentBuilder();
    xmlDoc = documentBuilder.parse(xmlFile);

    return xmlDoc;
  },

  /**
   * Returns the attributes
   * @param {org.w3c.dom.Element} xmlElement XML element
   * @return {Object} Attributes object
   */
  getAttributes: function (xmlElement) {
    var attributes = {},
        namedNodeMap, i, node, nodeName, nodeValue;

    if (!xmlElement) {
      throw "XML element is empty";
    }

    namedNodeMap = xmlElement.attributes;

    if (namedNodeMap) {
      for (i = 0; i < namedNodeMap.length; i++) {
        node = namedNodeMap.item(i);
        nodeName = node.nodeName + "";
        nodeValue = node.nodeValue + "";
        attributes[nodeName] = nodeValue;
      }
    }

    return attributes;
  },

  /**
   * Returns a new xml string transformed by the given XSLT stream
   * @param {java.io.InputStream} inputXmlStream XML inputStram
   * @param {java.io.InputStream} xsltInputStream XSLT inputStream
   * @return {String} Tranformed xml
   */
  transformByXslt: function (inputXmlStream, xsltInputStream) {
    var xsltSource, transformerFactory, transformer, xmlStreamSource, outputXmlString, stringWriter;

    if (!inputXmlStream) {
      throw "'htmlInputStream' is missing";
    }
    if (!xsltInputStream) {
      throw "'xsltInputStream' is missing";
    }

    transformerFactory = javax.xml.transform.TransformerFactory.newInstance();
    xsltSource = new javax.xml.transform.stream.StreamSource(xsltInputStream);
    transformer = transformerFactory.newTransformer(xsltSource);

    xmlStreamSource = new javax.xml.transform.stream.StreamSource(inputXmlStream);
    stringWriter = new java.io.StringWriter();
    transformer.transform(xmlStreamSource, new javax.xml.transform.stream.StreamResult(stringWriter));
    outputXmlString = stringWriter.toString();
    return outputXmlString;
  }
});

/**
 * @private
 * XML builder
 */
sol.define("sol.common.XmlBuilder", {

  /**
   * @cfg {org.w3c.dom.Document}
   * XML document
   */

  initialize: function (config) {
    var me = this;

    if (config.xmlDoc) {
      me.xmlDoc = config.xmlDoc;
    }
  },

  /**
   * Creates a new XML document
   * @param {String} rootTagName Name of the root element.
   * @param {Array} attribObj Attributes of the root element.
   * @return {org.w3c.dom.Document} Created XML document.
   */
  createXml: function (rootTagName, attribObj) {
    var me = this;
    me.xmlDoc = Packages.javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
    if (rootTagName) {
      me.rootElement = me.addElement(me.xmlDoc, rootTagName, "", attribObj);
      return me.rootElement;
    }
    return me.xmlDoc;
  },

  /**
   * Adds an element to the XML document
   * @param {org.w3c.dom.Node} parentElement Parent element.
   * @param {String} tagName Tag name of the new element.
   * @param {String} content Content of the new element.
   * @param {Object} attribObj Attributes of the new element as map.
   * @return {Object} newElement element to the XML document.
   */
  addElement: function (parentElement, tagName, content, attribObj) {
    var me = this,
        newElement = this.xmlDoc.createElement(tagName),
        key;
    if (attribObj) {
      for (key in attribObj) {
        newElement.setAttribute(key, attribObj[key]);
      }
    }
    if (content) {
      newElement.appendChild(me.xmlDoc.createTextNode(content));
    }
    parentElement.appendChild(newElement);
    return newElement;
  },

  /**
   * Creates a new XML document by JavaScript object
   * @param {Object} data Data object that contains the data that should be converted into XML
   * @param {Object} dataDefintion Definition object that contains meta information for the transformation.
   */
  buildFromJson: function (data, dataDefintion) {
    var me = this,
        rootTagName;
    if (!data) {
      throw "Data is missing.";
    }
    if (!dataDefintion) {
      throw "Data defintion is missing.";
    }
    rootTagName = me.getFirstPropName(data);
    if (!rootTagName) {
      throw "Root tag name is empty.";
    }
    me.dataDefinition = dataDefintion;
    me.columnSeparator = me.columnSeparator || ", ";

    me.processObj(data, me.createXml());
  },

  /**
   * @private
   * Recursive method that converts JavaScript object elements to XML
   * @param {Object} obj Data object that contains the data that should be converted into XML
   * @param {org.w3c.dom.Document} parentElement XML document.
   */
  processObj: function (obj, parentElement) {
    var me = this,
        key, newElement, arr, arrElement, arrTagName, value, i;
    for (key in obj) {
      if (typeof obj[key] === "object") {
        if (Array.isArray(obj[key])) {
          arr = obj[key];
          if (!me.dataDefinition.arrayElementTagNames) {
            throw "Array names not defined";
          }
          arrTagName = me.dataDefinition.arrayElementTagNames[key];
          if (!arrTagName) {
            throw "Array tag name for property '" + key + "' is not defined.";
          }
          arrElement = me.addElement(parentElement, key);
          for (i = 0; i < arr.length; i++) {
            newElement = me.addElement(arrElement, arrTagName);
            me.processObj(arr[i], newElement);
          }
        } else {
          newElement = me.addElement(parentElement, key);
          me.processObj(obj[key], newElement);
        }
      } else {
        value = obj[key] || "";
        value = value.replace(/¶/g, me.columnSeparator);
        me.addElement(parentElement, key, value);
      }
    }
  },

  /**
   * @private
   * Returns the first property of an object.
   * @param {Object} obj Data object that contains the data that should be converted into XML
   * @return {String} prop.
   */
  getFirstPropName: function (obj) {
    var key;
    for (key in obj) {
      return key;
    }
  },

  /**
   * Renders the XML document as string
   * @return {String} XML document as string.
   */
  toString: function () {
    var me = this,
        source, result,
        transformer = javax.xml.transform.TransformerFactory.newInstance().newTransformer();
    transformer.setOutputProperty(javax.xml.transform.OutputKeys.METHOD, "xml");
    if (!me.withDeclation) {
      transformer.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "yes");
    }
    if (me.standalone) {
      me.xmlDoc.standalone = true;
    }
    transformer.setOutputProperty(javax.xml.transform.OutputKeys.INDENT, "yes");
    transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "4");
    source = new javax.xml.transform.dom.DOMSource(this.xmlDoc);
    result = new javax.xml.transform.stream.StreamResult(new java.io.StringWriter());
    transformer.transform(source, result);
    return String(result.writer.toString());
  },

  /**
   * Returns the root element of the XML document.
   * @return {org.w3c.dom.Document} XML document
   */
  getXmlDoc: function () {
    var me = this;
    return me.xmlDoc;
  },

  /**
   * Returns the namespace
   * @param {org.w3c.dom.Node} node Node
   */
  getNamespaceUri: function (node) {
    var me = this,
        namespace;

    node = node || me.xmlDoc.documentElement;

    namespace = node.getNamespaceURI();

    return namespace;
  }
});


