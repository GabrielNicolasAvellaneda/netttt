SRCS = \
	src/ttt.js \
	src/neural.js \
	src/ai.js \
	src/netttt.js

BUNDLE = src/netttt.bundle.js

WORKER_SRCS = \
	$(BUNDLE) \
	main.worker.js

WORKER_BUNDLE = main.worker.bundle.js


all: worker

bundle: $(BUNDLE)
$(BUNDLE): $(SRCS)
	cat $^ > $@

worker: $(WORKER_BUNDLE)
$(WORKER_BUNDLE): $(WORKER_SRCS)
	cat $^ > $@

clean:
	rm -f $(BUNDLE) $(WORKER_BUNDLE)

.PHONY: all bundle worker clean
