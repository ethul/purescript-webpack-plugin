'use strict';

var path = require('path');

var globby = require('globby');

var immutable = require('immutable');

var moduleParser = require('./module-parser');

var cwd = process.cwd();

function insertGlobs(parser, globs, map, callback) {
  var promise =
    globby(globs).then(function(files){
      return files.reduce(function(b, a){
        var name = parser(a);
        return name !== null ? b.set(name, path.join(cwd, a)) : b;
      }, map);
    })
  ;

  promise.then(
    function(result){callback(null, result)},
    function(error){callback(error, null)}
  );
}

function emptyMap() {
  return immutable.Map();
}
module.exports.emptyMap = emptyMap;

function insertSrcGlobs(srcGlobs, map, callback) {
  insertGlobs(moduleParser.srcNameSync, srcGlobs, map, callback);
}
module.exports.insertSrcGlobs = insertSrcGlobs;

function insertFFIGlobs(ffiGlobs, map, callback) {
  insertGlobs(moduleParser.ffiNameSync, ffiGlobs, map, callback);
}
module.exports.insertFFIGlobs = insertFFIGlobs;
