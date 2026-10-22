# CUBEA — Ideology: what the revolution says, and what hearing it does

*Code: `js/ideology.js`. All numbers in its `TUNE` block. Sources and the reading list: `RESEARCH.md`. The texts are real; what each one does in the game is our reading of its themes, not a quotation, and needs review by Cuban historians.*

## Model
* Six values for every person, −1…+1: **patria, tierra, justicia, disciplina, fe, igualdad**. Starting values from faction/class/occupation plus ordinary scatter.
* The **creed** is what *you* have been saying: a running average over every text you read, speech you give, letter you write, promise you make. You tailor it by choosing what to say — there is no creed slider.
* The **deeds** are what you have been doing on the same axes (justice and discipline reputation, land actually granted, equality decisions…).
* **Alignment** = closeness of a person's values to the creed. **Gap** = how much you preach what you do not practise.

## Delivering words (all verbs, all physical)
| Verb | Where | Effect |
|---|---|---|
| Read aloud | at a fire or blackboard; anyone in earshot | a text's value vector pulls listeners toward it (literacy not needed) |
| Address them | on a person or the ground; choose an emphasis | nearby listeners drift; larger crowds help; costs energy |
| Hand a pamphlet / nail up a poster | to a literate person / anywhere | slow, private (pamphlet) or ambient (poster) drift |
| Write a letter | to one literate person, about one value | ×3 the pull of a speech, and it builds a bond — and sceptics take it seriously |
| Say… (voice) | on a person | options **depend on the listener**: a hungry soldier hears "Eat first"; an unarmed one can be promised a rifle; a peasant can be promised land, seed, medicine; a doubter can be asked what they think |

**Receptivity** depends on hope, hunger, and trust in the speaker. **Sceptics** (literate, educated, students) resist propaganda but not respect.

## What it does to troops
| Variable | Effect |
|---|---|
| alignment ↑ | daily loyalty ↑, hope ↑, obedience ↑ (more with a disciplined creed) |
| zeal (0–100, from repeated aligned, emotional words) | braver; quarrels with doubters (zealot vs unconvinced in one squad costs friendship); shatters hardest when word and deed diverge |
| gap (hypocrisy) | loyalty ↓, zeal ↓, hope ↓; soldiers say it out loud ("They said one thing and did another…") |
| a call for vengeance | works, and drags *justicia* negative — the troops become what you tell them to be |

## Promises
`C.promise(person, kind, days)` creates a ledger entry (land, seed, rifle, medicine, rest, release…). Deeds mark them kept (`C.promiseFulfil`): granting a plot, sowing it, bandaging, arming… Past the due date they break: a negative memory along the person's family edges, honesty down, hope down.

## UI
**Y** opens the creed panel: what you say vs what you do (per value), how many of your people agree, zeal, the gap, and the promises you owe.

## Open questions
Cuban reviewers on emphasis and wording of texts; whether *fe* should split into popular religion and the hierarchy; a Radio Rebelde broadcast as a mass-exposure verb; letters from the people to the player (the other direction); interrogation and "re-education" as a dark mirror of the same mechanic.
