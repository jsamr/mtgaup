.PHONY: build
.PHONY: deps
.PHONY: install
.PHONY: uninstall

BINARY := dist/mtgaup

ifeq ($(PREFIX),)
    PREFIX := /usr/local
endif

build: deps
	npm run build

deps: ## Install all required dependencies
	npm install --loglevel=error

install:
	install $(BINARY) $(DESTDIR)$(PREFIX)/bin

uninstall:
	rm $(DESTDIR)$(PREFIX)/bin/mtgaup