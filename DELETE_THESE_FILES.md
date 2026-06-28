# Files to DELETE from your repo

These two files are no longer used anywhere — the (?) HelpIcon system has
been fully replaced by the first-login product tour. Delete them:

    src/components/HelpIcon.tsx
    src/lib/helpText.ts

Every page that used to import HelpIcon has already been updated in this
delivery to no longer reference it — deleting these two files will not
break anything.
