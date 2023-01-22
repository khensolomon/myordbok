import core from "lethil";
import mysql from "mysql2";
// import mongodb from 'mongodb';
import { setting } from "./assist/anchor/config.js";

core.set("config", setting);
core.set("root", process.cwd());
// core.set("root", "./test?");
// core.set("hostname", "localhost");
// core.set("port", 8087);
// core.set("config", config);
core.set("mysql", mysql);
// core.set("mongo", mongodb);

export default core;
