HUGO ?= hugo
THEME_DIR ?= ../oink
BIND ?= 127.0.0.1
PORT ?= 1313

.PHONY: dev serve build
dev:
	GOWORK=off HUGO_MODULE_WORKSPACE=off HUGO_MODULE_REPLACEMENTS='github.com/pgsty/oink -> $(abspath $(THEME_DIR))' $(HUGO) server --renderToMemory --bind $(BIND) --port $(PORT)

serve:
	env -u HUGO_MODULE_REPLACEMENTS GOWORK=off HUGO_MODULE_WORKSPACE=off $(HUGO) server --bind $(BIND) --port $(PORT)

build:
	env -u HUGO_MODULE_REPLACEMENTS GOWORK=off HUGO_MODULE_WORKSPACE=off $(HUGO) --minify --environment production --printPathWarnings --panicOnWarning
