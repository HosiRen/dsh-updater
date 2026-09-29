# Third-Party Notices

This package ships one JavaScript artifact per face. `lib/index.js` and `lib/update-runner.js` **bundle portions of the third-party libraries listed under "Bundled into the Host artifact"**, so their license texts are reproduced here in full, as those licenses require. Nothing else in this package is copied from another project.

## Bundled into the Host artifact

Both libraries below are part of the [Cordis](https://github.com/cordisjs/cordis) foundation layer. DeepSeek Harness vendors them under its own npm scope (`@deepseek-ai/*`); the names, versions, and copyright holders recorded here are the upstream ones.

### schemastery

| | |
|---|---|
| Version | 3.18.4 |
| License | MIT |
| Copyright | Copyright (c) 2021-present Shigma |
| Source | <https://github.com/deepseek-harness/schemastery> |

Used to declare and validate this plugin's `Config` schema. The bundler inlines it because the plugin is not a member of the Harness workspace, so the installing checkout's top-level `node_modules` resolves neither it nor its dependency.

```
MIT License

Copyright (c) 2021-present Shigma

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### cosmokit

| | |
|---|---|
| Version | 1.8.5 |
| License | MIT |
| Copyright | Copyright (c) 2021-present Shigma |
| Source | <https://github.com/deepseek-harness/cosmokit> |

A dependency of schemastery, inlined for the same reason.

```
MIT License

Copyright (c) 2021-present Shigma

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Loaded from the host at run time

`lib/client.js` **contains no third-party code**. It reaches React through the Harness Web module table, which the host populates; the plugin neither bundles nor redistributes it.

| Component | License | Copyright | Note |
|---|---|---|---|
| React | MIT | Copyright (c) Meta Platforms, Inc. and affiliates | Provided by the host application |

## Build-time tools

These produced the artifacts above but are **not distributed** with them, so no license text is reproduced here. They are listed for transparency, and because one of them is not permissively licensed.

| Tool | License | Role |
|---|---|---|
| lightningcss | MPL-2.0 | Compiles the settings page's CSS Modules into an injected stylesheet at build time |
| tsdown | MIT | Bundles the Host and browser artifacts |
| rolldown | MIT | Underlying bundler for tsdown |
| TypeScript | Apache-2.0 | Type checking and declaration emission |
| Vitest | MIT | Test runner |
| tsx | MIT | Runs TypeScript sources directly during development and testing |

MPL-2.0 is a file-level copyleft license whose source-disclosure obligations attach to the licensed files and to modifications of them. lightningcss is used unmodified as a build tool, and none of its code is included in this package, so no corresponding source is distributed here.

## Host platform

This plugin is written for **DeepSeek Harness** (<https://github.com/deepseek-ai/deepseek-harness>, MIT), whose plugin and service interfaces it calls at run time. No DeepSeek Harness code is copied into this package: every one of its imports is either a Node.js built-in module or one of the two libraries disclosed above.
