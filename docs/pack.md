# pack

Package a zip file for uploading to Lambda with all the required NPM dependencies, without deploying it anywhere.
Works with any JavaScript Lambda project, not just Claudia-related deployments.

## Usage

```bash
claudia pack {OPTIONS}
```

## Options

*  `--output`:  (_optional_) Output file path
    * _Defaults to_: File in the current directory named after the NPM package name and version
*  `--force`:  (_optional_) If set, existing output files will be overwritten
    * _Defaults to_: not set, so trying to write over an existing output file will result in an error
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--no-optional-dependencies`:  (_optional_) Do not pack optional dependencies.
*  `--use-local-dependencies`:  (_optional_) Do not install dependencies, use the local node_modules directory instead
*  `--npm-options`:  (_optional_) Any additional options to pass on to NPM when installing packages. Check https://docs.npmjs.com/cli/install for more information
    * _For example_: --ignore-scripts
    * _Introduced in version_: 5.0.0
*  `--post-package-script`:  (_optional_) the name of a NPM script to execute custom processing after claudia finished packaging your files.
    Note that development dependencies are not available at this point, but you can use npm uninstall to remove utility tools as part of this step.
    * _For example_: customNpmScript
    * _Introduced in version_: 5.0.0
