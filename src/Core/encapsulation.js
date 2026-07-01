'use strict';
/**
 * encapsulation.js — JS obfuscation helper
 * Uses js-confuser (already in Core-botifyX dependencies)
 */
const Confuser = require('js-confuser');
const fs       = require('fs');
const path     = require('path');

async function obfuscateJS(inputPath) {
    const source = fs.readFileSync(inputPath, 'utf8');

    const obfuscated = await Confuser.obfuscate(source, {
        target: 'node',
        preset: 'medium',
    });

    const outPath = inputPath.replace(/\.js$/, '-obfuscated.js');
    fs.writeFileSync(outPath, obfuscated, 'utf8');
    return outPath;
}

module.exports = { obfuscateJS };
