
//@include lib_Class.js

/**
 * Utility sort callback functions to sort arrays.
 *
 * @requires sol.commom.DateUtils
 */
sol.define("sol.common.ObjectSortUtils", {
  singleton: true,

  default: function (a, b) {
    if (a === b) {
      return 0;
    } else {
      return a < b ? -1 : 1;
    }
  },

  date: function (a, b) {
    return sol.common.DateUtils.isoToMoment(a)
      .diff(sol.common.DateUtils.isoToMoment(b));
  },

  number: function (a, b) {
    a = parseFloat(a);
    b = parseFloat(b);
    return sol.common.ObjectSortUtils.default(a, b);
  }

});

/**
 * @author MHe (ELO Digital Office GmbH)
 *
 * @requires sol.common.ObjectUtils
 * @requires sol.common.ObjectSortUtils
 */
sol.define("sol.common.mixins.ObjectSort", {
  mixin: true,

  /**
     * Sort an array by specify sortCriteria.
     *
     * Imagine you have the following array:
     *
     *     [ { data: { propA: "A", propB: "B"} }, {data: { propA: "A", propB: "B"} }]
     *
     * If you want to sort by propA you can use the following sortCriteria structure.
     *  { prop: "data.propA" }
     *
     * Now the array will be sort by the object prop `propA` with ObjectSortUtils.default sort function.
     *
     * The sortCriteria will be used ObjectUtils.getProp function to determine the object property,
     * so the object could be sort by deeper structures as well as flat structures
     *
     * If you want simple sort an array by a prop you can easily pass the object keypath
     * instead of a sortCritiera object
     *
     *    sortCriterias: ["data.propA"]
     *
     * A sortCriteria has furthermore options. To use another sorting strategy you can pass
     * another function from ObjectSortUtils. Currently supported functions are default, date, number
     *
     *  sortCriterias: [{ prop: "data.propDate", type: "date" }]
     *
     * @param {Array<Object>} arr The array to sort
     * @param {Array<Object>} sortCriterias determine the props to sort
     * @param {*} options object
     * @param {Boolean} [options.clone=true] If you want to sort the original object set this option to false. Default is true
     *
     *
     * @returns sorted array
     */
  sortArray: function (arr, sortCriterias, options) {
    var arrayToSort = arr, me = this,
        ObjectUtils = sol.common.ObjectUtils,
        ObjectSortUtils = sol.common.ObjectSortUtils,
        propSortAlgorithm = function (a, b) {
          var result, aValue, bValue, sortFunction, index = 0,
              currentCriteria = sortCriterias[index];

          do {
            aValue = ObjectUtils.getProp(a, currentCriteria.prop);
            bValue = ObjectUtils.getProp(b, currentCriteria.prop);

            // Call dynamically the passed sort function. If the type doesn't exist
            // default sort function will be used
            me.logger.debug(["current type {0}, {1}", currentCriteria.type, ObjectSortUtils[currentCriteria.type]]);
            sortFunction = ObjectSortUtils[currentCriteria.type] || ObjectSortUtils.default;
            result = sortFunction.call(me, aValue, bValue);

            currentCriteria = sortCriterias[++index];
            // perform sort criteria as soon as sort criteria are available
            // so we can sort after multiple criteria
          } while (result === 0 && currentCriteria);

          return result;
        };

    options = options || {};
    options.clone = options.clone || true;

    if (!arr) {
      throw Error("`arr` is not defined");
    }

    if (options.clone) {
      // make a copy of the arr to sort - avoid potentially side effects
      arrayToSort = ObjectUtils.clone(arr);
    }

    me.logger.debug(["sort criteria {0}", JSON.stringify(sortCriterias)]);

    me.hasSortCriteria(sortCriterias)
        && arrayToSort.sort(propSortAlgorithm);

    return arrayToSort;
  },

  hasSortCriteria: function (sortCriterias) {
    return sortCriterias && sortCriterias.length > 0;
  },

  generateSort: function (sorts) {
    var sortStatements = [], statement,
        ObjectUtils = sol.common.ObjectUtils;

    if (sorts && !sol.common.ObjectUtils.isArray(sorts)) {
      throw "`options.sort` must be an array! current type: " + typeof sorts;
    }

    ObjectUtils.forEach(sorts, function (el) {
      if (ObjectUtils.isObject(el)) {
        if (!el.prop) {
          throw Error("`options.sort` entry need attribute `prop`. Example: { 'prop': 'name' }");
        }

        statement = el;
      } else if (ObjectUtils.isString(el)) {
        statement = { prop: el };
      } else {
        throw Error("`options.sort` entry could not parse " + JSON.stringify(el));
      }

      sortStatements.push(statement);
    });

    return sortStatements;
  }
});