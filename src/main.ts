import "./ui/ui.css";
import { Game } from "./Game.ts";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const game = new Game(canvas);
void game.start();
