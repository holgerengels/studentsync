package studentsync.domains;

import studentsync.base.Diff;

import javax.json.Json;
import javax.json.JsonWriter;
import javax.servlet.http.HttpServletResponse;
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
