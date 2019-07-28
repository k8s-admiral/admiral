#!/usr/bin/env bash
set -e

DESIRED_NODE_VERSION=v$(cat package.json | grep -Ei "\"node\"" | grep -Eoi "[0-9]+\.[0-9]+\.[0-9]+") 

export FNM_DIR="$(pwd)/.fnm"
if [ ! -d "$FNM_DIR" ]; then
    curl https://raw.githubusercontent.com/Schniz/fnm/master/.ci/install.sh | bash -s -- --install-dir `pwd`/.fnm --skip-shell
fi

NODE_DIR="$FNM_DIR/node-versions/$DESIRED_NODE_VERSION/installation/bin"
export PATH="$FNM_DIR:$NODE_DIR:$PATH"

eval `fnm env --multi`


if [ ! -f "$NODE_DIR/node" ]; then
    fnm install $DESIRED_NODE_VERSION
fi


sumOfPackageJson() {
    cat package.json | md5sum | cut -d' ' -f1
}

if [ ! -f ".packageRevision" ] || [ "$(cat .packageRevision)" != "$(sumOfPackageJson)" ]; then
    sumOfPackageJson > .packageRevision
    npm install
fi
