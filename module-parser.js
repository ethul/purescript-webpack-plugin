'use strict';

var fs = require('fs');

var SRC_RE = /(?:^|\n)module\s+([\w\.]+)/;

var FFI_RE = /(?:^|\n)\/\/\s+module\s+([\w\.]+)/;

function nameSync(regex, file) {
  var contents = fs.readFileSync(file, {encoding: 'utf-8'});

  var match = contents.match(regex);

  return match === null ? null : match[1];
}

function srcNameSync(file) {
  return nameSync(SRC_RE, file);
}
module.exports.srcNameSync = srcNameSync;

function ffiNameSync(file) {
  return nameSync(FFI_RE, file);
}
module.exports.ffiNameSync = ffiNameSync;
