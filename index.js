'use strict';

var path = require('path');

var fs = require('fs');

var child_process = require('child_process');

var PSC = 'psc';

var PSC_BUNDLE = 'psc-bundle';

var REQUIRE_PATH = '../';

var PURS = '.purs';

var MODULE_RE = /(?:^|\n)module\s+([\w\.]+)/;

function PurescriptWebpackPlugin(options) {
  this.options = Object.assign({
    src: [
      path.join('src', '**', '*.purs'),
      path.join('bower_components', 'purescript-*', 'src', '**', '*.purs')
    ],
    ffi: [
      path.join('src', '**', '*.js'),
      path.join('bower_components', 'purescript-*', 'src', '**', '*.js')
    ],
    output: 'output',
    bundleOutput: path.join('output', 'bundle.js'),
    bundleNamespace: 'PS'
  }, options);

  this.context = {};
}

PurescriptWebpackPlugin.prototype.bundleModuleNames = function(){
  var entries = this.context.bundleEntries;

  var modules = this.context.compilation.modules;

  var moduleNames = entries.map(function(entry){
    var module_ = modules.filter(function(module_){
      return module_.rawRequest === entry.request;
    });

    if (!module_[0]) return null;
    else {
      var file = module_[0].resource;

      var contents = fs.readFileSync(file, {encoding: 'utf-8'});

      var match = contents.match(MODULE_RE);

      if (match === null) return null;
      else {
        return match[1];
      }
    }
  });

  var nonNullNames = moduleNames.filter(function(name){ return name !== null; });

  return nonNullNames;
};

PurescriptWebpackPlugin.prototype.bundle = function(callback){
  var moduleNames = this.bundleModuleNames();

  if (moduleNames.length === 0) callback("No entry point module names found.", null);
  else {
    var moduleArgs = moduleNames.reduce(function(b, a){ return b.concat(['-m', a]); }, []);

    var args = moduleArgs.concat([
      '-n', this.options.bundleNamespace,
      '-r', REQUIRE_PATH,
      path.join(this.options.output, '**', 'index.js'),
      path.join(this.options.output, '**', 'foreign.js')
    ]);

    var psc = child_process.spawn(PSC_BUNDLE, args);

    var stdout = '';

    var stderr = '';

    psc.stdout.on('data', function(data){
      stdout = stdout + data.toString();
    });

    psc.stderr.on('data', function(data){
      stderr = stderr + data.toString();
    });

    psc.on('close', function(code){
      var error = code !== 0 ? stderr : null;
      callback(error, stdout);
    });
  }
};

PurescriptWebpackPlugin.prototype.compile = function(callback){
  var ffiArgs = this.options.ffi.reduce(function(b, a){ return b.concat(['-f', a]); }, []);

  var args = ffiArgs.concat([
    '-o', this.options.output,
    '-r', REQUIRE_PATH
  ]).concat(this.options.src);

  var psc = child_process.spawn(PSC, args);

  var stderr = '';

  psc.stderr.on('data', function(data){
    stderr = stderr + data.toString();
  });

  psc.on('close', function(code){
    var error = code !== 0 ? stderr : null;
    callback(error);
  });
};

PurescriptWebpackPlugin.prototype.apply = function(compiler){
  var plugin = this;

  compiler.plugin('compilation', function(compilation, params){
    Object.assign(plugin.context, {
      requiresCompiling: true,
      bundleEntries: [],
      callbacks: [],
      compilation: null,
      compile: function(callback){
        return function(){
          var callbacks = plugin.context.callbacks;
          callbacks.push(callback);

          if (plugin.context.requiresCompiling) {
            plugin.context.requiresCompiling = false;
            plugin.compile(function(error){
              if (error) callbacks.forEach(function(callback){callback(error)()});
              else {
                plugin.bundle(function(error, result){
                  var result_ = result + 'module.exports = ' + plugin.options.bundleNamespace + ';';
                  fs.writeFile(plugin.options.bundleOutput, result_, function(error_){
                    callbacks.forEach(function(callback){callback(error_ || error)()});
                  });
                });
              }
            });
          }
        };
      }
    });

    compilation.plugin('normal-module-loader', function(loaderContext, module){
      if (path.extname(module.userRequest) === PURS) {
        plugin.context.compilation = compilation;
        loaderContext.purescriptWebpackPluginContext = plugin.context;
      }
    });
  });

  compiler.plugin('normal-module-factory', function(normalModuleFactory){
    normalModuleFactory.plugin('before-resolve', function(data, callback){
      if (path.extname(data.request) === PURS) {
        plugin.context.bundleEntries.push(data);
      }
      callback(null, data);
    });
  });
};

module.exports = PurescriptWebpackPlugin;
