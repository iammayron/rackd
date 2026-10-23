package dev.rackd.wear;

import java.util.ArrayList;
import java.util.List;

/** Where the watch looks after a set is logged. */
public final class ExerciseFocus {
    public static final class Row {
        public final String name;
        public final boolean completed;

        public Row(String name, boolean completed) {
            this.name = name;
            this.completed = completed;
        }
    }

    private ExerciseFocus() {}

    /**
     * The exercise to show. Stays on {@code focus} while it still has an open set.
     * Otherwise the next exercise that does, wrapping around. Null when every set
     * is logged.
     */
    public static String nextOpen(List<Row> rows, String focus) {
        List<String> names = names(rows);
        if (names.isEmpty()) return null;
        if (focus == null || !names.contains(focus)) {
            for (String name : names) {
                if (hasOpen(rows, name)) return name;
            }
            return null;
        }
        if (hasOpen(rows, focus)) return focus;
        int start = names.indexOf(focus);
        for (int step = 1; step < names.size(); step++) {
            String name = names.get((start + step) % names.size());
            if (hasOpen(rows, name)) return name;
        }
        return null;
    }

    private static boolean hasOpen(List<Row> rows, String name) {
        for (Row row : rows) {
            if (row != null && name.equals(row.name) && !row.completed) return true;
        }
        return false;
    }

    private static List<String> names(List<Row> rows) {
        List<String> names = new ArrayList<>();
        if (rows == null) return names;
        for (Row row : rows) {
            if (row == null || row.name == null || row.name.isEmpty()) continue;
            if (names.isEmpty() || !names.get(names.size() - 1).equals(row.name)) names.add(row.name);
        }
        return names;
    }
}
