import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const http = createServer(app);

const io = new Server(http, {
  cors: {
    origin: "*"
  }
});

app.use(
  express.static(__dirname)
);

const MAX = 100;

const players = new Map();
const buildings = new Map();
const items = new Map();

const weapons = {

  AR: {
    damage: 25,
    rate: 160,
    range: 120
  },

  SMG: {
    damage: 12,
    rate: 80,
    range: 90
  },

  Shotgun: {
    damage: 12,
    rate: 700,
    range: 35
  }

};

for(
  let i = 0;
  i < 45;
  i++
){

  const types = [
    "ammo",
    "heal",
    "AR",
    "SMG",
    "Shotgun"
  ];

  const type =
    types[
      Math.floor(
        Math.random() *
        types.length
      )
    ];

  items.set(
    "item-" + i,
    {
      id:"item-" + i,
      type,

      x:
        (Math.random()-.5)*500,

      y:0,

      z:
        (Math.random()-.5)*500

    }
  );

}

function spawn(){

  return {

    x:
      (Math.random()-.5)*160,

    y:0,

    z:
      (Math.random()-.5)*160,

    yaw:0

  };

}

function distance(a,b){

  return Math.hypot(
    a.x-b.x,
    a.y-b.y,
    a.z-b.z
  );

}

function normalize(v){

  const l =
    Math.hypot(
      v.x,
      v.y,
      v.z
    ) || 1;

  return {

    x:v.x/l,
    y:v.y/l,
    z:v.z/l

  };

}

function publicPlayer(p){

  return {

    id:p.id,

    x:p.x,
    y:p.y,
    z:p.z,

    yaw:p.yaw,

    hp:p.hp,

    alive:p.alive

  };

}

function rayHit(
  origin,
  direction,
  target,
  radius=1.5
){

  const x =
    target.x-origin.x;

  const y =
    target.y-origin.y;

  const z =
    target.z-origin.z;

  const t =
    x*direction.x +
    y*direction.y +
    z*direction.z;

  if(t < 0)
    return false;

  const a =
    origin.x +
    direction.x*t;

  const b =
    origin.y +
    direction.y*t;

  const c =
    origin.z +
    direction.z*t;

  return Math.hypot(
    target.x-a,
    target.y-b,
    target.z-c
  ) <= radius;

}

function sendCount(){

  io.emit(
    "playerCount",
    {
      count:players.size,
      max:MAX
    }
  );

}

function checkWinner(){

  const alive =
    [
      ...players.values()
    ].filter(
      p => p.alive
    );

  if(
    alive.length === 1
  ){

    io.emit(
      "winner",
      {
        id:alive[0].id
      }
    );

  }

}

io.on(
  "connection",
  socket => {

    sendCount();

    socket.on(
      "play",
      () => {

        if(
          players.has(
            socket.id
          )
        )
          return;

        if(
          players.size >= MAX
        ){

          socket.emit(
            "serverFull"
          );

          return;

        }

        const s =
          spawn();

        const player = {

          id:socket.id,

          ...s,

          hp:100,

          alive:true,

          lastShot:0

        };

        players.set(
          socket.id,
          player
        );

        socket.emit(
          "matchState",
          {

            me:player,

            players:
              [
                ...players.values()
              ]
              .filter(
                p =>
                  p.id !== socket.id
              )
              .map(
                publicPlayer
              ),

            buildings:
              [
                ...buildings.values()
              ],

            items:
              [
                ...items.values()
              ]

          }
        );

        socket.broadcast.emit(
          "playerJoined",
          publicPlayer(player)
        );

        sendCount();

      }
    );

    socket.on(
      "move",
      d => {

        const p =
          players.get(
            socket.id
          );

        if(
          !p ||
          !p.alive
        )
          return;

        if(
          [
            d.x,
            d.y,
            d.z,
            d.yaw
          ].some(
            v =>
              typeof v !== "number" ||
              !Number.isFinite(v)
          )
        )
          return;

        if(
          distance(
            p,
            d
          ) > 12
        )
          return;

        p.x =
          Math.max(
            -290,
            Math.min(
              290,
              d.x
            )
          );

        p.y =
          Math.max(
            0,
            Math.min(
              20,
              d.y
            )
          );

        p.z =
          Math.max(
            -290,
            Math.min(
              290,
              d.z
            )
          );

        p.yaw =
          d.yaw;

        socket.broadcast.emit(
          "playerMoved",
          {

            id:p.id,

            x:p.x,
            y:p.y,
            z:p.z,

            yaw:p.yaw

          }
        );

      }
    );

    socket.on(
      "shoot",
      d => {

        const p =
          players.get(
            socket.id
          );

        const w =
          weapons[d.weapon];

        if(
          !p ||
          !p.alive ||
          !w
        )
          return;

        const now =
          Date.now();

        if(
          now-p.lastShot <
          w.rate
        )
          return;

        p.lastShot =
          now;

        if(
          !d.direction
        )
          return;

        const direction =
          normalize(
            d.direction
          );

        const origin = {

          x:p.x,

          y:p.y+1.5,

          z:p.z

        };

        let hit = null;

        let best =
          Infinity;

        for(
          const target
          of players.values()
        ){

          if(
            target.id ===
            p.id
          )
            continue;

          if(
            !target.alive
          )
            continue;

          const d =
            distance(
              p,
              target
            );

          if(
            d > w.range ||
            d > best
          )
            continue;

          if(
            rayHit(
              origin,
              direction,
              {
                x:target.x,
                y:target.y+1,
                z:target.z
              }
            )
          ){

            hit = target;

            best = d;

          }

        }

        if(!hit)
          return;

        const damage =
          d.weapon === "Shotgun"
            ? 12
            : w.damage;

        hit.hp =
          Math.max(
            0,
            hit.hp-damage
          );

        io.to(
          hit.id
        ).emit(
          "damage",
          {
            amount:damage
          }
        );

        io.emit(
          "health",
          {
            id:hit.id,
            hp:hit.hp
          }
        );

        if(
          hit.hp <= 0
        ){

          hit.alive =
            false;

          io.emit(
            "eliminated",
            {
              id:hit.id,
              killer:p.id
            }
          );

          checkWinner();

        }

      }
    );

    socket.on(
      "build",
      d => {

        const p =
          players.get(
            socket.id
          );

        if(
          !p ||
          !p.alive
        )
          return;

        if(
          ![
            "wall",
            "floor",
            "ramp"
          ].includes(
            d.type
          )
        )
          return;

        if(
          [
            d.x,
            d.y,
            d.z,
            d.ry
          ].some(
            v =>
              typeof v !== "number" ||
              !Number.isFinite(v)
          )
        )
          return;

        if(
          distance(
            p,
            d
          ) > 9
        )
          return;

        const id =
          socket.id +
          "-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(16)
            .slice(2);

        const building = {

          id,

          owner:
            socket.id,

          type:d.type,

          x:d.x,
          y:d.y,
          z:d.z,

          ry:d.ry

        };

        buildings.set(
          id,
          building
        );

        io.emit(
          "buildingCreated",
          building
        );

      }
    );

    socket.on(
      "pickupItem",
      id => {

        const p =
          players.get(
            socket.id
          );

        const item =
          items.get(id);

        if(
          !p ||
          !p.alive ||
          !item
        )
          return;

        if(
          distance(
            p,
            item
          ) > 5
        )
          return;

        items.delete(id);

        io.emit(
          "itemPickedUp",
          {
            itemId:id
          }
        );

        socket.emit(
          "reward",
          {
            type:item.type
          }
        );

      }
    );

    socket.on(
      "disconnect",
      () => {

        players.delete(
          socket.id
        );

        for(
          const [
            id,
            building
          ]
          of buildings
        ){

          if(
            building.owner ===
            socket.id
          ){

            buildings.delete(
              id
            );

          }

        }

        io.emit(
          "playerLeft",
          socket.id
        );

        sendCount();

        checkWinner();

      }
    );

  }
);

const port =
  process.env.PORT ||
  3000;

http.listen(
  port,
  () => {

    console.log(
      "Sky Island Royale server running"
    );

    console.log(
      `http://localhost:${port}`
    );

  }
);