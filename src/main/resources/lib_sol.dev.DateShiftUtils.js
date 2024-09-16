
importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js

/**
 * Shifts dates
 *
 * @author ELO Digital Office GmbH
 *
 * @elojc
 * @eloas
 * @eloix
 *
 * @requires moment
 * @requires sol.common.DateUtils
 * @requires sol.common.SordUtils
 * @requires sol.common.RepoUtils
 */
sol.define("sol.dev.DateShiftUtils", {
  singleton: true,

  /**
   * Shift Dates
   * @param {Object} params Parameters
   * @returns {Object} Result
   */
  shiftDates: function (params) {
    var me = this,
        result, refDate, now, unit,
        sords, i, sord, sordResult;

    if (!params) {
      throw "Parameters are emtpy";
    }

    if (!params.parentId) {
      throw "Parent ID is empty";
    }

    result = {
      sords: []
    };

    sords = sol.common.RepoUtils.findChildren(params.parentId, {
      maskId: params.mask,
      level: -1,
      recursive: true,
      includeReferences: true
    });

    refDate = sol.common.DateUtils.isoToDate(params.refDateIso);
    now = new Date();

    params.units = {
      y: {},
      Q: {},
      M: {},
      w: {},
      d: {}
    };

    for (unit in params.units) {
      params.units[unit].number = Math.floor(sol.common.DateUtils.diff(refDate, now, unit));
    }

    result.params = params;

    for (i = 0; i < sords.length; i++) {
      sord = sords[i];
      sordResult = me.shiftSordDates(sord, params);
      result.sords.push(sordResult);
    }

    return result;
  },

  /**
   * @private
   * Shift sord dates
   * @param {de.elo.ix.client.Sord} sord Sord
   * @param {Object} params Parameters
   */

  shiftSordDates: function (sord, params) {
    var me = this,
        newMapKeyValues = [],
        sordChanged = false,
        result, i, j, shift, key, oldMapKeyValues,
        oldValue, newValue, newKeyValue, sordIdInt;

    if (!sord) {
      throw "Sord is empty";
    }

    if (!params) {
      throw "Parameters are empty";
    }

    if (!params.refDateIso) {
      throw "Reference date is empty";
    }

    result = {
      id: sord.id + "",
      name: sord.name + "",
      shifts: []
    };

    for (i = 0; i < params.shifts.length; i++) {
      shift = params.shifts[i];
      if (!shift.key) {
        throw "Shift key is empty";
      }

      shift.unit = shift.unit || "d";

      if (!params.units[shift.unit]) {
        throw "Unkown shift unit '" + shift.unit + "'";
      }
      switch (shift.type) {
        case "SORD":
          oldValue = sol.common.SordUtils.getValue(sord, shift) + "";
          if (me.isIsoDate(oldValue)) {
            newValue = me.shift(oldValue, params, shift);
            sol.common.SordUtils.updateSord(sord, [{ type: shift.type, key: shift.key, value: newValue }]);
            sordChanged = true;
            result.shifts.push({ type: shift.type, key: shift.key, oldValue: oldValue, withTime: shift.withTime, unit: shift.unit, endOfUnit: shift.endOfUnit, newValue: newValue });
          }
          break;

        case "GRP":
          oldValue = sol.common.SordUtils.getObjKeyValue(sord, shift.key) + "";
          if (me.isIsoDate(oldValue)) {
            newValue = me.shift(oldValue, params, shift);
            sol.common.SordUtils.setObjKeyValue(sord, shift.key, newValue);
            sordChanged = true;
            result.shifts.push({ type: shift.type, key: shift.key, oldValue: oldValue, withTime: shift.withTime, unit: shift.unit, endOfUnit: shift.endOfUnit, newValue: newValue });
          }
          break;

        case "MAP":

          oldMapKeyValues = oldMapKeyValues || ixConnect.ix().checkoutMap(MapDomainC.DOMAIN_SORD, sord.id + "", null, LockC.NO).items;

          if (shift.key.indexOf("{i}") > -1) {
            j = 1;
            while (true) {
              key = shift.key.replace("{i}", j);
              oldValue = me.getMapValue(oldMapKeyValues, key);
              if (me.isIsoDate(oldValue)) {
                newValue = me.shift(oldValue, params, shift);
                newKeyValue = new KeyValue(key, newValue);
                newMapKeyValues.push(newKeyValue);
                result.mapKeys = result.mapKeys || {};
                result.shifts.push({ type: shift.type, key: key, oldValue: oldValue, withTime: shift.withTime, unit: shift.unit, endOfUnit: shift.endOfUnit, newValue: newValue });
                j++;
              } else {
                break;
              }
            }
          } else {
            oldValue = me.getMapValue(oldMapKeyValues, shift.key);
            if (me.isIsoDate(oldValue)) {
              newValue = me.shift(oldValue, params, shift);
              newKeyValue = new KeyValue(shift.key, newValue);
              newMapKeyValues.push(newKeyValue);
              result.mapKeys = result.mapKeys || {};
              result.shifts.push({ type: shift.type, key: shift.key, oldValue: oldValue, withTime: shift.withTime, unit: shift.unit, endOfUnit: shift.endOfUnit, newValue: newValue });
            }
          }
          break;

        default:
          throw "Shift field type '" + shift.type + "' is unsupported";
      }
    }

    if (sordChanged) {
      ixConnect.ix().checkinSord(sord, SordC.mbAllIndex, LockC.NO);
    }

    if (newMapKeyValues.length > 0) {
      sordIdInt = java.lang.Integer.valueOf(sord.id + "");
      ixConnect.ix().checkinMap(MapDomainC.DOMAIN_SORD, sord.id + "", sordIdInt, newMapKeyValues, LockC.NO);
    }

    return result;
  },

  /**
   * @private
   * Returns a map key value
   * @param {de.elo.ix.client.KeyValue[]} keyValues Map key values
   * @param {String} keyName Key name
   * @return {String} Value
   */
  getMapValue: function (keyValues, keyName) {
    var i, keyValue, value;

    if (!keyValues) {
      throw "Key values are empty";
    }

    if (!keyName) {
      throw "Key name is empty";
    }

    for (i = 0; i < keyValues.length; i++) {
      keyValue = keyValues[i];
      if (keyValue.key == keyName) {
        value = keyValue.value + "";
        return value;
      }
    }

    return "";
  },

  /**
   * @private
   * Calculates the new date
   * @param {String} oldDateIso Old date ISO
   * @param {Object} params Parameters
   * @param {Object} shift Shift parameters
   * @return {String} New ISO date
   */
  shift: function (oldDateIso, params, shift) {
    var oldDate, newDate, newDateIso, momentDate, number;

    if (!params) {
      throw "Parameters are empty";
    }

    if (!shift) {
      throw "Shift parameters are empty";

    }

    shift.unit = shift.unit || "d";

    oldDate = sol.common.DateUtils.isoToDate(oldDateIso);
    number = params.units[shift.unit].number;
    newDate = sol.common.DateUtils.shift(oldDate, number, { unit: shift.unit, shouldBeWorkingDay: shift.shouldBeWorkingDay });

    if (shift.endOfUnit) {
      momentDate = moment(newDate.getTime());
      newDate = momentDate.endOf(shift.endOfUnit).toDate();
    }

    newDateIso = sol.common.DateUtils.dateToIso(newDate, { withoutTime: !shift.withTime });

    if ((oldDateIso.length > 8) && (newDateIso.length == 8)) {
      newDateIso += "000000";
    }

    return newDateIso;
  },

  isIsoDate: function (isoDate) {
    var result;

    if (!isoDate) {
      return false;
    }
    result = /^2\d{7,13}$/.test(isoDate);
    return result;
  }
});

