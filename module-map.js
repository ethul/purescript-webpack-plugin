'use strict';

var path = require('path');

var globby = require('globby');

var immutable = require('immutable');

var moduleParser = require('./module-parser');

var cwd = process.cwd();

function insertGlobs(parser, files, moduleMap, modificationMap1, modificationMap2, callback) {
  var result =
    files.reduce(function(moduleMap_, file){
      var previous = modificationMap1.get(file);

      var current = modificationMap2.get(file);

      var isUnmodified = previous && current && previous >= current;

      if (isUnmodified) return moduleMap_;
      else {
        var name = parser(file);

        var updated = name !== null ? moduleMap_.set(name, file) : moduleMap_;

        return updated;
      }
    }, moduleMap);

  callback(null, result);
}

function emptyMap() {
  return immutable.Map();
}
module.exports.emptyMap = emptyMap;

function insertSrc(srcs, moduleMap, modificationMap1, modificationMap2, callback) {
  insertGlobs(moduleParser.srcNameSync, srcs, moduleMap, modificationMap1, modificationMap2, callback);
}
module.exports.insertSrc = insertSrc;

function insertFFI(ffis, moduleMap, modificationMap1, modificationMap2, callback) {
  insertGlobs(moduleParser.ffiNameSync, ffis, moduleMap, modificationMap1, modificationMap2, callback);
}
module.exports.insertFFI = insertFFI;
