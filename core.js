import core from "lethil";
import mysql from "mysql2";
// import mongodb from 'mongodb';
// import { settings } from "./assist/anchor/config.js";

core.set.only("root", process.cwd());
// core.set.only("root", "./test?");
// core.set("hostname", "localhost");
// core.set("port", 8087);
// core.set("config", config);
core.set.only("mysql", mysql);
// core.set.only("mongo", mongodb);
// core.set.only("config", settings);

export default core;
