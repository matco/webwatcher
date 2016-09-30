# js-grid
js-grid displays your tabular data in a nice HTML grid.

**grid.html** contains some examples showing how to use it.

## Usage
The branch ```subtreeable``` contains only required files (no example nor tests). It allows to easily import this widget in your project using [Git subtree](https://git-scm.com/book/en/v1/Git-Tools-Subtree-Merging).

First, add this repository as a remote to your project:
```
git remote add -f js-grid https://github.com/matco/js-grid.git
```
Then, create the subtree from branch ```subtreeable``` (be sure to update the folder path in the command below):
```
git subtree add --prefix=js-grid-folder --squash js-grid/subtreeable
```

Later, to update code of the widget in your project (again, update folder path in second command):
```
git fetch js-grid subtreeable
git subtree pull --prefix=js-grid-folder --squash js-grid subtreeable
```
