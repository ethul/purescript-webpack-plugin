'use strict';

var path = require('path');

var fs = require('fs');

var child_process = require('child_process');

var dargs = require('dargs');

var debug = require('debug')('purescript-webpack-plugin');

var fileGlobber = require('./file-globber');

var modificationMap = require('./modification-map');

var moduleMap = require('./module-map');

var dependencyGraph = require('./dependency-graph');

var moduleParser = require('./module-parser');

var REQUIRE_PATH = '../';

var PURS = '.purs';

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
    bundleNamespace: 'PS',
    psc: 'psc',
    pscArgs: {},
    pscBundle: 'psc-bundle',
    pscBundleArgs: {}
  }, options);

  this.context = {};

  this.cache = {
    srcFiles: [],
    ffiFiles: [],
    srcModificationMap: modificationMap.emptyMap(),
    ffiModificationMap: modificationMap.emptyMap(),
    srcModuleMap: moduleMap.emptyMap(),
    ffiModuleMap: moduleMap.emptyMap(),
    dependencyGraph: dependencyGraph.emptyGraph()
  };
}

PurescriptWebpackPlugin.prototype.bundleModuleNames = function(){
  var entries = this.context.bundleEntries;

  var modules = this.context.compilation.modules;

  var moduleNames = entries.map(function(entry){
    var module_ = modules.filter(function(module_){
      return module_.userRequest === entry.userRequest;
    });

    if (!module_[0]) return null;
    else {
      var file = module_[0].resource;

      var result = moduleParser.srcNameSync(file);

      return result;
    }
  });

  var nonNullNames = moduleNames.filter(function(name){ return name !== null; });

  return nonNullNames;
};

PurescriptWebpackPlugin.prototype.bundle = function(callback){
  var moduleNames = this.bundleModuleNames();

  if (moduleNames.length === 0) callback(new Error("No entry point module names found."), null);
  else {
    var args = Object.assign({}, this.options.pscBundleArgs, {
      module: moduleNames,
      namespace: this.options.bundleNamespace,
      requirePath: REQUIRE_PATH,
      _:  [
        path.join(this.options.output, '**', 'index.js'),
        path.join(this.options.output, '**', 'foreign.js')
      ]
    });

    var args_ = dargs(args);

    var pscBundle = child_process.spawn(this.options.pscBundle, args_);

    var stdout = '';

    var stderr = '';

    pscBundle.stdout.on('data', function(data){
      stdout = stdout + data.toString();
    });

    pscBundle.stderr.on('data', function(data){
      stderr = stderr + data.toString();
    });

    pscBundle.on('close', function(code){
      var error = code !== 0 ? new Error(stderr) : null;
      callback(error, stdout);
    });
  }
};

PurescriptWebpackPlugin.prototype.compile = function(callback){
  var args = Object.assign({}, this.options.pscArgs, {
    ffi: this.options.ffi,
    output: this.options.output,
    requirePath: REQUIRE_PATH,
    _: this.options.src
  });

  var args_ = dargs(args);

  var psc = child_process.spawn(this.options.psc, args_);

  var stderr = '';

  psc.stderr.on('data', function(data){
    stderr = stderr + data.toString();
  });

  psc.on('close', function(code){
    var error = code !== 0 ? new Error(stderr) : null;
    callback(error, stderr);
  });
};

PurescriptWebpackPlugin.prototype.updateDependencies = function(bundle, callback){
  var plugin = this;

  var options = plugin.options;

  var cache = plugin.cache;

  plugin.scanFiles(function(error, result){
    moduleMap.insertSrc(result.srcFiles, cache.srcModuleMap, cache.srcModificationMap, result.srcModificationMap, function(error, srcMap){
      if (error) callback(error, cache);
      else {
        moduleMap.insertFFI(result.ffiFiles, cache.ffiModuleMap, cache.ffiModificationMap, result.ffiModificationMap, function(error, ffiMap){
          if (error) callback(error, cache);
          else {
            dependencyGraph.insertFromBundle(bundle, options.bundleNamespace, dependencyGraph.emptyGraph(), function(error, graph){
              if (error) callback(error, cache);
              else {
                var result_ = {
                  srcFiles: result.srcFiles,
                  ffiFiles: result.ffiFiles,
                  srcModificationMap: result.srcModificationMap,
                  ffiModificationMap: result.ffiModificationMap,
                  srcModuleMap: srcMap,
                  ffiModuleMap: ffiMap,
                  dependencyGraph: graph
                };

                callback(null, result_);
              }
            });
          }
        });
      }
    });
  });
};

PurescriptWebpackPlugin.prototype.scanFiles = function(callback){
  var plugin = this;

  fileGlobber.glob(plugin.options.src, function(error, srcs){
    if (error) callback(error, null);
    else {
      fileGlobber.glob(plugin.options.ffi, function(error, ffis){
        if (error) callback(error, null);
        else {
          modificationMap.insert(srcs, modificationMap.emptyMap(), function(error, srcMap){
            if (error) callback(error, null);
            else {
              modificationMap.insert(ffis, modificationMap.emptyMap(), function(error, ffiMap){
                if (error) callback(error, null);
                else {
                  var result = {
                    srcFiles: srcs,
                    ffiFiles: ffis,
                    srcModificationMap: srcMap,
                    ffiModificationMap: ffiMap
                  };

                  callback(null, result);
                }
              });
            }
          });
        }
      });
    }
  });
};

PurescriptWebpackPlugin.prototype.apply = function(compiler){
  var plugin = this;

  function compile(options) {
    return function(callback){
      return function(){
        var callbacks = plugin.context.callbacks;

        callbacks.push(callback);

        var invokeCallbacks = function(error, result){
          callbacks.forEach(function(callback){
            callback(error)(result)()
          });
        };

        var cache = {
          srcMap: plugin.cache.srcModuleMap,
          ffiMap: plugin.cache.ffiModuleMap,
          graph: plugin.cache.dependencyGraph,
          output: ''
        };

        if (plugin.context.requiresCompiling) {
          plugin.context.requiresCompiling = false;

          debug('Compiling PureScript files');

          plugin.compile(function(error, output){
            if (error) invokeCallbacks(error, cache);
            else {
              debug('Bundling compiled PureScript files');

              plugin.bundle(function(error, bundle){
                if (error) invokeCallbacks(error, cache);
                else {
                  debug('Updating dependency graph of PureScript bundle');

                  plugin.updateDependencies(bundle, function(error, result){
                    var cache_ = {
                      srcMap: result.srcModuleMap,
                      ffiMap: result.ffiModuleMap,
                      graph: result.dependencyGraph,
                      output: output
                    };

                    Object.assign(plugin.cache, result);

                    debug('Generating result for webpack');

                    var bundle_ = bundle + 'module.exports = ' + plugin.options.bundleNamespace + ';';

                    fs.writeFile(plugin.options.bundleOutput, bundle_, function(error_){
                      invokeCallbacks(error_ || error, cache_);
                    });
                  });
                }
              });
            }
          });
        }
      };
    };
  }

  compiler.plugin('compilation', function(compilation, params){
    Object.assign(plugin.context, {
      requiresCompiling: true,
      bundleEntries: [],
      callbacks: [],
      compilation: null,
      compile: compile(compilation.compiler.options)
    });

    compilation.plugin('normal-module-loader', function(loaderContext, module){
      if (path.extname(module.userRequest) === PURS) {
        plugin.context.compilation = compilation;
        loaderContext.purescriptWebpackPluginContext = plugin.context;
      }
    });
  });

  compiler.plugin('normal-module-factory', function(normalModuleFactory){
    normalModuleFactory.plugin('after-resolve', function(data, callback){
      if (path.extname(data.userRequest) === PURS) {
        plugin.context.bundleEntries.push(data);
      }
      callback(null, data);
    });
  });
};

module.exports = PurescriptWebpackPlugin;
