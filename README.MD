# MTGAUP

*Magic The Gathering Arena Update Program for Wine and Lutris users*

This program will, on request, check for new versions of MTGA, download and install them from semi-official forum thread: [https://forums.mtgarena.com/forums/threads/58489](https://forums.mtgarena.com/forums/threads/58489)

## Install

### With NPM

```
npm install -g mtgaup
```

### Build and install from source

**You must have `node` and `npm` installed on your system.**

```
git clone https://github.com/jsamr/mtgaup.git
cd mtgaup
make
make install
```

## Prerequisites

You need two environment variables set on your session:

- `MTGA_WINE_PREFIX`, the wine prefix for MTGA install. Example: `$HOME/Games/magic-the-gathering-arena`
- `MTGA_WINE_BINARY`, the wine binary used for MTGA. Example (Lutris): `$HOME/.local/share/lutris/runners/wine/tkg-unity-4.1-x86_64/bin/wine`

## How to use

```
mtgaup -h
```