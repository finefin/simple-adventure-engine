# Fine Adventure

A point-and-click adventure engine built on Phaser. Games are created entirely by editing `src/data/world.json`.

## Data Format

All game content lives in a single JSON file loaded at boot.

### Rooms

A room is a 800x600 area with walls, a floor, objects, and doors.

```json
"living_room": {
  "name": "Living Room",
  "backgroundColor": "0x1a1a2e",
  "wallColor": "0x4a3a2a",
  "floorColor": "0x3a3a4a",
  "wallThickness": 24,
  "playerStart": { "x": 200, "y": 400 },
  "objects": [ ... ],
  "doors": [ ... ]
}
```

| Field | Description |
|---|---|
| `name` | Displayed in the top-left corner |
| `backgroundColor` | Fill behind the walls |
| `wallColor` | The 4 borders (default thickness 24px) |
| `floorColor` | The inner walkable area |
| `wallThickness` | Optional, defaults to 24 |
| `playerStart` | Where the player spawns when entering this room |
| `objects` | Array of interactable objects |
| `doors` | Array of exits to other rooms |

The walkable area is calculated as `wallThickness + 16` inset from each edge. 
Objects with `"blocks": true` are treated as impassable by the pathfinder.

### Doors

Doors connect rooms. Clicking a door walks the player to it and transitions to the target room.

```json
{
  "id": "door_kitchen",
  "x": 740, "y": 280,
  "width": 12, "height": 60,
  "color": "0xcc8833",
  "label": "Kitchen",
  "targetRoom": "kitchen",
  "targetX": 80,
  "targetY": 300
}
```

`targetX`/`targetY` is where the player lands in the target room. Use the room's `playerStart` position for a natural entry.

### Objects

Objects are the interactable elements in each room. Two shapes are supported: `rect` and `circle`.

```json
{
  "id": "potted_plant",
  "type": "circle",
  "x": 300, "y": 400,
  "radius": 18,
  "color": "0x44aa44",
  "label": "Potted Plant",
  "interactable": true,
  "blocks": true,
  "lookMessage": "A thriving basil plant."
}
```

#### Common Properties

| Field | Description |
|---|---|
| `id` | Unique string identifier. Used for combines, states, reveals |
| `type` | `"rect"` or `"circle"` |
| `x`, `y` | Center position in the room |
| `width`, `height` | For `rect` objects |
| `radius` | For `circle` objects |
| `color` | Hex fill, e.g. `"0x44aa44"` |
| `strokeColor` | Optional hex border |
| `label` | Displayed below the object |
| `interactable` | Must be `true` for clicks to register |
| `blocks` | `true` makes the object impassable to the player |
| `hiddenBy` | ID of another object. This object is invisible until revealed |

#### Messages

These define what text appears when the player uses a verb on the object.

| Field | Description |
|---|---|
| `lookMessage` | Shown when selecting "Examine" |
| `useMessage` | Shown when selecting "Use" |
| `openMessage` | Shown when selecting "Open" |
| `talkMessage` | Shown when selecting "Talk" (if no dialogTree) |

Each message can be overridden per-state (see States section).

#### Verbs

The action menu shows these verbs based on object properties:

| Verb | Condition |
|---|---|
| Examine | Always shown (default) |
| Take | Shown when `"pickup": true` |
| Open | Shown when `openMessage` is defined |
| Talk | Shown when `talkMessage` or `dialogTree` is defined |
| Use | Always shown (default) |
| Use with... | Shown for inventory items only |

### Pickups

Objects with `"pickup": true` can be taken to the inventory bar at the bottom of the screen. They are removed from the room and added to the player's inventory.

```json
{
  "id": "key",
  "type": "circle",
  "x": 400, "y": 370,
  "radius": 8,
  "color": "0xffd700",
  "label": "Key",
  "interactable": true,
  "hiddenBy": "table",
  "lookMessage": "A small golden key.",
  "pickup": true,
  "useMessage": "It might fit something around here."
}
```

### States

Objects can have multiple states that change their appearance, messages, and behavior. The default state is defined by `"state"` on the object.

```json
{
  "id": "stove",
  "type": "rect",
  "x": 600, "y": 400,
  "color": "0x555555",
  "label": "Stove",
  "state": "off",
  "lookMessage": "A cast iron stove. It's cold.",
  "useMessage": "Nothing to light it with.",
  "states": {
    "on": {
      "lookMessage": "The stove crackles with a warm flame.",
      "useMessage": "The fire is already lit."
    }
  }
}
```

When the stove's state is `"off"`, examine shows "A cast iron stove. It's cold." When the state changes to `"on"`, it shows "The stove crackles with a warm flame."

State changes happen through:
- **Combines** with `"setState"` in the result
- **Open** verb with `"openSetsState"` on the object

### Hidden Objects

Objects can be hidden behind other objects. They only appear when revealed.

The parent object lists children to reveal:

```json
{
  "id": "table",
  "lookMessage": "A wooden table. There's something underneath it.",
  "examineReveals": ["key"]
}
```

The child references the parent:

```json
{
  "id": "key",
  "hiddenBy": "table",
  "lookMessage": "A small golden key.",
  "pickup": true
}
```

Revealing happens through two mechanisms:

1. **`examineReveals`** — reveals children when the player examines the parent. Used when the player should discover something by looking (e.g. finding a key under a table).

2. **`reveals`** — reveals children when the parent's state changes via `setObjState`. Used when the player must perform an action (e.g. using a key on a desk) to reveal the child.

If you want both (examine reveals AND state-change reveals), include both fields.

### Combines

Items can be combined with other objects or items. From the inventory, select "Use with..." on an item, then click the target object in the room or another inventory item.

Combine results are defined in `combineMessages` on either object. The key is the other object's `id`.

```json
{
  "id": "stove",
  "combineMessages": {
    "matches": {
      "message": "You light the stove. A warm flame flickers to life.",
      "setState": "on"
    }
  }
}
```

This matches when matches are used on the stove. The result has:
- `message` — displayed text
- `setState` — changes the target object's state

Combine messages can also be plain strings (no `setState`):

```json
{
  "id": "key",
  "combineMessages": {
    "desk": "The key slides into the lock and turns. The desk drawer swings open."
  }
}
```

Plain strings only show the message without changing state. To also change state, the target object should define an object result instead.

The engine checks both directions: if object A has a `combineMessages` entry for B's ID, that matches. If not, it checks B's entry for A's ID. Object results are preferred over string results, and both are checked with the room object first, then the inventory item.

#### Conditional Combines

Combine results can require specific world state conditions:

```json
{
  "id": "old_photo",
  "combineMessages": {
    "stove": {
      "requiresState": [{ "id": "stove", "state": "on" }],
      "message": "The photo curls and blackens in the flames.",
      "setState": "burnt"
    },
    "matches": {
      "message": "You try to burn the photo but the flame is too small."
    }
  }
}
```

`requiresState` is an array of `{id, state}` pairs. ALL conditions must be met for the result to apply. If conditions fail, the engine falls through to the next candidate. Here, burning the photo at the stove only works if the stove is lit; otherwise the matches result is used (or nothing happens if no match).

### Object Doors

Objects can become doors when state conditions are met. This allows secret passages that unlock via item progression.

```json
{
  "id": "statue",
  "type": "rect",
  "x": 530, "y": 340,
  "color": "0x888888",
  "label": "Statue",
  "becomesDoor": {
    "requiresState": [{ "id": "old_photo", "state": "burnt" }],
    "targetRoom": "underground",
    "targetX": 400,
    "targetY": 300,
    "openColor": "0x666688",
    "message": "The statue grinds and slides aside, revealing dark stairs.",
    "openLookMessage": "The statue has shifted aside, revealing a stairway down."
  }
}
```

| Field | Description |
|---|---|
| `requiresState` | Conditions that must be true for the door to activate |
| `targetRoom` | Room to transition to |
| `targetX`, `targetY` | Spawn position in the target room |
| `openColor` | Optional — the object changes to this color when activated |
| `message` | Displayed when the door opens |
| `openLookMessage` | Overrides `lookMessage` once open |

The door activates when the condition(s) are met by a combine result (e.g. using a burnt photo on the statue opens the passage).

### Dialogs

Objects with `talkMessage` or `dialogTree` support the Talk verb. A `dialogTree` creates a branching conversation:

```json
{
  "id": "old_man",
  "label": "Old Man",
  "lookMessage": "An old man with a long grey beard.",
  "talkMessage": "He grunts and looks away.",
  "dialogTree": {
    "start": {
      "text": "Evening, stranger.",
      "options": [
        { "text": "Who are you?", "next": "who" },
        { "text": "Goodbye.", "next": null }
      ]
    },
    "who": {
      "text": "I'm the caretaker.",
      "options": [
        { "text": "Seen anything strange?", "next": "strange" },
        { "text": "I should go.", "next": null }
      ]
    },
    "strange": {
      "text": "The study gives me the creeps.",
      "options": [
        { "text": "Okay...", "next": null }
      ]
    }
  }
}
```

Each node has `text` (NPC dialog) and `options` (player responses). Set `next: null` to end the conversation. `dialogStart` on the object overrides the default `"start"` entry point.

### OpenVerb and openSetsState

Objects with `openMessage` show the Open verb. If `openSetsState` is defined, the object's state changes when opened:

```json
{
  "id": "cupboard",
  "state": "closed",
  "lookMessage": "A wooden cupboard with a small drawer.",
  "openMessage": "Inside the cupboard: a single matchbox.",
  "openSetsState": "open",
  "states": {
    "open": {
      "lookMessage": "The cupboard stands open, its drawer pulled out.",
      "openMessage": "Already open."
    }
  }
}
```

Opening the cupboard reveals the matches inside (via `setObjState` → `reveals` if the cupboard had a `reveals` field).

### Stock Objects

Some objects with `"pickup": true` are initially placed in rooms but hidden by `hiddenBy` or sitting in the open. When picked up, they move to the inventory bar and are no longer rendered in any room.

### Build Process

No build step is required. The game runs directly from `index.html` using the Phaser framework file. All game data is read from `src/data/world.json` at runtime.

To add a new room:
1. Add an entry to the `"rooms"` object with objects, doors, and visual properties
2. Add a door in the starting room that links to it
3. Reference the room's key in other doors' `targetRoom` fields

To add a new object:
1. Choose a unique `id`
2. Place it at coordinates within the walkable area (wallThickness + 16 to 800 - wallThickness - 16)
3. Define its messages, shape, and interaction properties
4. If it should be hidden, add `hiddenBy` referencing the parent object's id

All coordinates use the Phaser coordinate system with origin at top-left.
