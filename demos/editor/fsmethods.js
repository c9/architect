var fs = require('fs');
exports.readFile = function (path, callback) {
  fs.readFile(path, 'utf8', callback);
};
exports.readdir = function (path, callback) {
  fs.readdir(path, callback);
};
