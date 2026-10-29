HUGO ?= hugo
PORT ?= 1314
BIND ?= 127.0.0.1

.PHONY: dev serve build check
dev serve:
	$(HUGO) server --renderToMemory --baseURL http://localhost:$(PORT)/ --bind $(BIND) --port $(PORT)

build:
	$(HUGO) --cleanDestinationDir --gc --minify --environment production --printPathWarnings

check:
	pnpm check
