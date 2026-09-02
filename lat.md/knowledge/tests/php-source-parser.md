---
lat:
  require-code-mention: true
---

# PHP Source Parser

PHP source analysis and code-reference scanning cover Laravel application and test files without treating Blade attributes as code references.

## Extracts PHP declarations and members

PHP source analysis resolves unqualified classes, interfaces, traits, enums, enum cases, methods, constants, properties, constructor-promoted properties, and top-level functions and constants.

## Tolerates Blade PHP templates

Files ending in `.blade.php` parse without errors and do not require Blade comment syntax support when they contain template markup.

## Traverses namespaces and conditional declarations

Declarations remain discoverable inside bracketed namespaces, global namespace blocks, and control flow. Anonymous classes, closures, and local variables do not leak symbols into the surrounding scope.

## Extracts promotion from syntax nodes

Constructor-promoted properties include untyped, reference, nullable, union, intersection, and attributed parameters. Ordinary parameters, comments, and default strings never create properties, and each property retains its own parameter range.

## Preserves complete declaration ranges

Source ranges include attributes, modifiers, multiline property and constant declarations, and property hooks. Signatures identify the declaration rather than its preceding attribute.

## Validates PHP source links end to end

The Markdown checker resolves core PHP declarations and members in bracketed namespaces, including promoted properties and conditional functions, while reporting a deliberately missing member.

## Scans PHP line comments without matching attributes

PHP `//` and `#` comments produce code-reference backlinks, while PHP 8 attributes such as `#[Attribute]` do not produce false `@lat:` references.
