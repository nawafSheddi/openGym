# Parallel content agents deleted each other's shared exercises

**Date:** 2026-10-13

## What happened
Three subagents wrote catalogue content in parallel, each with its own exercise-id range. Two of them created the same missing exercises ("frog stand", "german hang") at the same time. `validate.mjs` rejects duplicate names, so both agents "fixed" the clash by deleting their own copy and pointing at the other's. Neither copy survived, which left both agents' content referencing ids that no longer existed.

## Root cause
Disjoint id ranges prevent **id** collisions but not **name** collisions. Nobody owned exercises that more than one agent needed, so each agent resolved the clash locally, without knowing the other was doing the same at the same moment.

## Rule
When parallel agents may create the same shared resource, give it **one owner** before dispatch. Either pre-create the shared items, or name which agent creates them and tell the others to only reference them. Never ask two concurrent agents to resolve a conflict between themselves; the orchestrator resolves it once both have finished.
