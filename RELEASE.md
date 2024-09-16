# Release

Before doing a release, check to see if there are any outstanding changes or untracked files:

```
git status
git clean -fdxn
```

Commit changes, and make sure that any untracked files can be deleted. Then clean the repository:

```
git clean -fdx # actually delete untracked files
```

## Python release

To release a new version of jppype on PyPI, first make sure that the `build` package is installed: `pip install build`.

1. Update the release versions  with:
   ```bash
   tbump <new-version>
   cd ts-src
   jlpm install
   ```
2. Clean the repository and install npm package required for building the extension (commit the yarn.lock file if necessary):
   ```bash
   git clean -fdx
   ```
3. Generate Python packages and upload to PyPI:
   ```bash
   python -m build
   twine check dist/jppype-*
   twine upload dist/jppype-*
   ```
4. Update version to dev again:
   ```bash
   tbump <new-version>.dev0
   git commit -a -m 'Back to dev'
   git push
   git push --tags
   ```
