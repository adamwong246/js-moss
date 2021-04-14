## js-moss [![Build Status](https://travis-ci.org/1e1f/js-moss.svg?branch=master)](https://travis-ci.org/1e1f/js-moss) [![Coverage Status](https://coveralls.io/repos/github/1e1f/js-moss/badge.svg?branch=master)](https://coveralls.io/github/1e1f/js-moss?branch=master)
[![NPM](https://nodei.co/npm/js-moss.png?downloads=true)](https://nodei.co/npm/js-moss/)

# What the heck is Moss?

Moss is a set of parsing rules for js objects, most often described in YAML-like syntax. It is a Turing-incomplete language that looks a bit like YAMl but is closer Kubernetes Helm. Moss aims to have serparable layers, each with an opinionated first choice that is ultimately swappable if desired. Moss is a language, a protocol and a network- together, it forms an alternative to the WWW, the World Wide Web, the network of links in HTML documents that we casually refer to as "the internet". 

## Wait, Moss replaces the internet?

Sort of. It could, perhaps someday, replace the internet by adoption but for now, Moss is a layer atop "the internet", aiming to accomplish what HTML could not. 

## First, a refresher on what "the internet" is

HTML is the language of the structured textual data underlying every webpage and "the web" is the hyperlinks between these documents. Every document or endpoint has a URL, the Uniform Resource Locator, essentually an address within the network and allows the hyperlinks to extend between pages and domains. Every URL is either a document (literally an html file served directly from the file system) or an api endpoint that computes the response dynamically. Browsers receieve this HTML and render it to the elements a user sees on their screen.

Moss replaces all of this.

Moss does not use html, ever. Moss _is_ the new html. Moss is an easier and terser way of writing what we now refer to has HTML.
Moss does not use URLs. What you know of as an URL is known, in Moss-land, as a "branch locator".
Moss does not use files. What you know of as a file is a "branch". 
Moss does not use templating. Moss, unlike html, can be dynamic, so you don't need another language like PHP, JS, Or Ruby to make a dynamic response. You can compose your branches from smaller pieces and re-use parts.

Moss branches are editable by default. In HTML, there is a distinction between `<input>` elements and all others. In moss-land, everything starts as a form and then is specified as uneditable. For this reason, Moss is perceived as a network of inter-linked _forms_, where "the web" is perceived as a network of inter-linked _documents._

Moss runs as a Node process with a mongo backend.

Your moss editor is in-browser and always gives you a live view of your changes as a rendered element.



# Moss



## Branches
Moss "branches" are somewhat like files but with key differences. A traditional file separates its data (the file contents) from its metadata (owner, permissions). In contrast, a Moss branch is identified by its first line, called a "branch locator".

## Branch locators

Example: context::name@Organzation Name~Folder/other tag:version

context aka "forest" - defines which layer 0 resolver to use if sourcing from another forest
name - just a file name.
Organization Name - Represents permissions
projectTags - User defined hints, similar to unix directories
version - server or a hash

## Layers of moss
```
0 binary
1 source
2 linked structured ast
3 declarative api
```
### Layer 0: "trunk" / container / binary:
opinionated default:
+ [Signet Protocol](https://github.com/ChromaPDX/signet), which is essentially an IPFS compatible container format

unopinionated alternatives:
+ database
+ filesystem
+ browser storage

### Layer 1: "branch" / source code:
opinionated default:
+ yaml

unopinionated alternatives:
+ JSON / xml / TOML
+ any trie-like format

### layer 2: "stem" / ast:
opinionated default:
+ js-moss (this package) hydrates yaml to object, async gql resolvers for linking

unopinionated alternatives:
+ load layer 1 into language specific ORM
+ be able to link other layer 2 objects.

### Layer 3: "leaf" / document:
opinionated default:
+ has a "kind" referenced in layer2
drives declarative api like k8s

unopinionated alternatives:
+ any runtime object



see more and use interactively in your browser @ https://triemake.com/moss/playground
