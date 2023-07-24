package studentsync.domains;

import jakarta.servlet.http.HttpServletResponse;
import studentsync.base.Diff;

import jakarta.json.Json;
import jakarta.json.JsonWriter;
import java.io.IOException;

import static studentsync.domains.JSON.json;

/**
 * Created by holger on 27.03.17.
 */
public class DiffGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("utf-8");
        JsonWriter writer = Json.createWriter(resp.getWriter());
        writer.writeArray(json(diff));
        writer.close();
    }
}
