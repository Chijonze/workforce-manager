ARG CHATWOOT_IMAGE_TAG=latest-ce
FROM chatwoot/chatwoot:${CHATWOOT_IMAGE_TAG}

COPY voice-widget-loader.html /tmp/voice-widget-loader.html

RUN ruby -e "paths = ['app/views/layouts/application.html.erb', 'app/views/layouts/vueapp.html.erb']; path = paths.find { |candidate| File.exist?(candidate) }; raise 'Chatwoot dashboard layout not found' unless path; marker = '<!-- workforce-twilio-voice-widget -->'; snippet = File.read('/tmp/voice-widget-loader.html'); html = File.read(path); unless html.include?(marker); html = html =~ %r{</body>}i ? html.sub(%r{</body>}i, snippet + \"\n</body>\") : html + \"\n\" + snippet + \"\n\"; File.write(path, html); end"
