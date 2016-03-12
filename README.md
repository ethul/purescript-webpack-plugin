# purescript-webpack-plugin

> [PureScript](http://www.purescript.org) plugin for [webpack](http://webpack.github.io)

## Install

Install with [npm](https://npmjs.org/package/purescript-webpack-plugin).

```
npm install purescript-webpack-plugin --save-dev
```

## Options

###### `src` (String Array)

Specifies the PureScript source files. Glob syntax is supported. The default value is `[ 'src/**/*.purs', 'bower_components/purescript-*/src/**/*.purs' ]`.

###### `ffi` (String Array)

Specifies the PureScript FFI files. Glob syntax is supported. The default value is `[ 'src/**/*.js', 'bower_components/purescript-*/src/**/*.js' ]`.

###### `output` (String)

Specifies the PureScript output path. The default value is `output`.

###### `bundleOutput` (String)

Specifies the PureScript bundle output path. The default value is `output/bundle.js`.

###### `bundleNamespace` (String)

Specifies the PureScript bundle namespace. The default value is `PS`.

###### `psc` (String)

Specifies the PureScript psc command. The default value is `psc`.

###### `pscArgs` (Object)

Specifies additional PureScript psc arguments. The default value is `{}`. The format of the arguments object follows [dargs](https://www.npmjs.com/package/dargs).

###### `pscBundle` (String)

Specifies the PureScript psc-bundle command. The default value is `psc-bundle`.

###### `pscBundleArgs` (Object)

Specifies additional PureScript psc-bundle arguments. The default value is `{}`. The format of the arguments object follows [dargs](https://www.npmjs.com/package/dargs).

###### `bundle` (Boolean)

Specifies whether PureScript bundle is used. The default value is `true`.

## Example

Refer to the [purs-loader](https://www.npmjs.com/package/purs-loader) for an example.
