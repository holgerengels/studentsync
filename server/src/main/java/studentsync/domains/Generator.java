package studentsync.domains;

import com.google.gson.JsonObject;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by holger on 26.03.17.
 */
public abstract class Generator<T> {
    private JsonObject config;

    public JsonObject getConfig() {
        return config;
    }

    public void setConfig(JsonObject config) {
        this.config = config;
    }

    public abstract void write(HttpServletResponse resp, T data) throws IOException;

    protected String nocomma(String string) {
        return string != null ? string.replace(',', ' ') : "";
    }

    protected String quote(String string) {
        return string != null ? '"' + string + '"' : "";
    }
}
