import parse from 'csv-parse';
import fs from 'fs';
import fetch from "node-fetch";
import existingDb from "../../bot/src/data";

const CSV_INPUT_FILE_PATH = "input/data.csv";
const CSV_INPUT_FILE_URL = new URL("../" + CSV_INPUT_FILE_PATH, import.meta.url);

async function retrieveCsvData() {
  console.log("Retrieving database...");

  const sheetId = "1xWFQgV3T2NOvfN_I8kvFxWHbH9i240rp2UFi2SEi6Zc";
  const sheetName = "Data";
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`);
  const data = await response.text();

  fs.writeFileSync(CSV_INPUT_FILE_URL, data);

  console.log(`CSV database written into "${CSV_INPUT_FILE_PATH}"!\n`);
}


async function process() {
  try {
    fs.accessSync(CSV_INPUT_FILE_URL);
    console.log(`Reading from "${CSV_INPUT_FILE_PATH}"...\n`);
  } catch (err) {
    await retrieveCsvData();
  }

  const parser = fs
    .createReadStream(CSV_INPUT_FILE_URL)
    .pipe(parse({ columns: true }));

  const classes = ["weapon", "base", "charm", "bait"];
  const db = {};

  function getDbClass(clazz) {
    if (!db[clazz]) db[clazz] = [];
    return db[clazz];
  }

  for await (const { ID: id, Name: name, Class: rawClass } of parser) {
    const itemClass = rawClass.toLowerCase();
    if (!classes.includes(itemClass)) continue;

    const existingItem = existingDb.getItem(id);
    if (existingItem) {
      console.log(`Item #${id} (${name}) already exists.`);
      getDbClass(itemClass).push(existingItem);
      continue;
    } else {
      console.log(`Processing item ${id}: ${name}`);
    }

    const item = {
      name,
      key: await getItemName(id),
      id
    };

    getDbClass(itemClass).push(item);
  }

  console.log();

  for (const itemClass of classes) {
    const items = db[itemClass];
    if (!items) continue;
    const fileName = `${itemClass}s.yml`;
    console.log(`Writing ${items.length} items to ${fileName}...`);

    const contents = items.flatMap(item => ([
      "- name: " + item.name,
      "  key: " + item.key,
      "  id: " + parseInt(item.id),
      ""
    ])).join("\n");

    fs.writeFileSync(new URL("../output/" + fileName, import.meta.url), contents, "utf8");
  }
}

const ITEM_NAME_REGEX = /data-item-type="([^"]+)"/;

function getItemName(id) {
  return fetch(`https://www.mousehuntgame.com/i.php?id=` + id)
    .then(res => res.text())
    .then(html => html.match(ITEM_NAME_REGEX)?.[1]);
}

process().then(() => console.log("\nDone!"));
