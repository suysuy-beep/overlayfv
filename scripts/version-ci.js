'use strict';
// Builds get a monotonically increasing patch number automatically, so users can update
// even when only a single CSS or JavaScript file changes.
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','package.json');
const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
const run=Number(process.env.GITHUB_RUN_NUMBER);
if(!Number.isSafeInteger(run)||run<1)throw new Error('Missing/invalid GITHUB_RUN_NUMBER');
const [major,minor]=pkg.version.split('.').map(Number);
if(!Number.isSafeInteger(major)||!Number.isSafeInteger(minor))throw new Error('Invalid package version');
pkg.version=`${major}.${minor}.${run}`;
fs.writeFileSync(file,JSON.stringify(pkg,null,2)+'\n');
process.stdout.write('Preparing Windows release '+pkg.version+'\n');
