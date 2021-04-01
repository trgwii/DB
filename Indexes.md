# Indexes

| Type                  | Data | Parent | ...Children(N) |
| --------------------- | ---- | ------ | -------------- |
| Root \| Middle \| End | Byte | Pos    | Pos            |

Indexes are made up of plain tables of "nodes", of which there is 1 root node (at the very start of the table), and N Middle and End nodes.

End nodes have pointer(s) to positions in the actual data table.

These indexes are only for equality lookups.

-   Waiting for edit / update functionality to implement.

## Creation / Insertion

1. Root node must always be created first.
1. Further nodes can be created by first inserting them, pointing parent to the root node, and then updating the root node to point to them.
