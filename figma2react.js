#!/usr/bin/env node
const fetch = require('node-fetch');
const headers = new fetch.Headers();
const figma = require('./lib/figma');
const program = require('commander');
const fs = require('fs');

const CONFIG = JSON.parse(fs.readFileSync('./.figma2react'));
headers.set('X-Figma-Token', CONFIG.token);

const BASE_URL = 'https://api.figma.com';

function generateComponents(data) {
  const canvas = data.document.children[0];

  const componentMap = {};
  canvas.children.forEach(child => {
    figma.createComponent(child, {}, componentMap);
  });

  const componentsDir = `./${CONFIG.directory.replace('./', '') || 'src/components'}`;
  const indexPath = `${componentsDir}/index.js`;

  try {
    fs.accessSync(componentsDir);
  } catch (e) {
    fs.mkdirSync(componentsDir, {recursive: true});
  }
  fs.writeFileSync(indexPath, '', 'utf-8');

  for (const key in componentMap) {
    let component = componentMap[key];
    let contents = `import React from "react"\n`;
    contents += "\n";
    contents += component.doc + "\n";

    try {
      const path = `${componentsDir}/${component.name}.js`;

      fs.writeFileSync(path, contents, 'utf-8');
      console.log(`wrote ${path}`);

      fs.appendFileSync(indexPath, `export * from "./${component.name}";\n`, 'utf-8');
      console.log(`append ${indexPath}`);
    }
    catch (e) {
      console.log(e.message);
    }
  }
}

async function fetchProject() {
  const response = await fetch(`${BASE_URL}/v1/files/${CONFIG.projectId}`, {headers});
  return response.json();
}

program
  .version('0.2.0')
  .description('Generates react components from figmas designs');

program
  .command('generate')
  .alias('g')
  .description('generate react component')
  .option("-c, --component [name]", "component name")
  .action(async () => generateComponents(await fetchProject()));

program
  .command('watch')
  .alias('w')
  .description('watch for changes in the figma projects and generate the components')
  .action(async () => {
    let data = await fetchProject(),
    currentDate = data.lastModified;

    setInterval(async () => {
      data = await fetchProject();

      if (data.lastModified > currentDate) {
        generateComponents(data);
        currentDate = data.lastModified;
        console.log(`project changed, making modifications!`);
      }
    }, 1000);

    console.log(`watching figma project ${CONFIG.projectId}`);
    console.log(`last modified ${currentDate}`);
  });

program.parse(process.argv);
