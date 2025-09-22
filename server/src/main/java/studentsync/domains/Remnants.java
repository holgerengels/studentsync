package studentsync.domains;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class Remnants {
    public static void main(String[] args) {
        String inputFile = "remnants.txt";
        String outputFile = "output.txt";

        try {
            // Schritt 1: Datei lesen und die zu behaltenden Zeilen sammeln
            List<String> linesToKeep = new ArrayList<>();
            BufferedReader reader = new BufferedReader(new FileReader(inputFile));
            String currentLine;

            while ((currentLine = reader.readLine()) != null) {
                currentLine = currentLine.trim();
                // Bedingung: Behalte die Zeile, wenn sie einen Punkt enthält
                // UND der Punkt NICHT an zweiter Stelle steht (Index 1).
                if (currentLine.contains(".") && currentLine.indexOf('.') != 1) {
                    linesToKeep.add(currentLine);
                }
            }
            reader.close();

            // Schritt 2: Die gefilterten Zeilen in die Ausgabedatei schreiben
            BufferedWriter writer = new BufferedWriter(new FileWriter(outputFile));
            for (String line : linesToKeep) {
                writer.write("rm -rf " + line + System.lineSeparator());
            }
            writer.close();

            System.out.println("Die Datei wurde erfolgreich verarbeitet!");
            System.out.println("Das Ergebnis wurde in " + outputFile + " gespeichert.");

        } catch (IOException e) {
            System.err.println("Fehler beim Lesen oder Schreiben der Datei: " + e.getMessage());
        }
    }
}
