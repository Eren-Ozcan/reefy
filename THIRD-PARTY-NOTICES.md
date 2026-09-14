# Third-Party Notices

Reefy bundles third-party components. Each remains under its own license,
independently of the terms in `LICENSE`.

## Fonts

| Font | Copyright | License | Full text |
| --- | --- | --- | --- |
| Nunito | 2014 The Nunito Project Authors | SIL Open Font License 1.1 | [public/licenses/Nunito-OFL.txt](public/licenses/Nunito-OFL.txt) |
| Fredoka | 2021 The Fredoka Project Authors | SIL Open Font License 1.1 | [public/licenses/Fredoka-OFL.txt](public/licenses/Fredoka-OFL.txt) |

The web fonts under `src/fonts/` are subsets of the upstream releases,
generated for this project. The OFL requires the license text above to
accompany every distribution of the font files, including the built
bundle in `dist/` and the packaged Android app.

## Runtime and build dependencies

Node dependencies are listed in `package.json`; their licenses ship in
`node_modules/<package>/LICENSE`. None of them is copyleft in a way that
affects distribution of this project: `sharp` (Apache-2.0 AND
LGPL-3.0-or-later) is a build-time dependency only and is not shipped in
the app bundle.

The files under `public/licenses/` are copied verbatim into `dist/licenses/`
by Vite, so every web and Android build ships the required license text.
