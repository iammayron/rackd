package dev.rackd.wear;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class ExerciseFocusTest {
    @Test
    public void staysOnTheExerciseWhileASetIsOpen() {
        List<ExerciseFocus.Row> rows = Arrays.asList(
            row("Squat", true),
            row("Squat", false),
            row("Bench", false)
        );
        assertEquals("Squat", ExerciseFocus.nextOpen(rows, "Squat"));
    }

    @Test
    public void jumpsToTheNextExerciseAfterItsLastSet() {
        List<ExerciseFocus.Row> rows = Arrays.asList(
            row("Squat", true),
            row("Squat", true),
            row("Bench", false),
            row("Row", false)
        );
        assertEquals("Bench", ExerciseFocus.nextOpen(rows, "Squat"));
    }

    @Test
    public void wrapsToAnEarlierOpenExercise() {
        List<ExerciseFocus.Row> rows = Arrays.asList(
            row("Squat", false),
            row("Bench", true),
            row("Row", true)
        );
        assertEquals("Squat", ExerciseFocus.nextOpen(rows, "Row"));
    }

    @Test
    public void returnsNullWhenTheWorkoutIsFinished() {
        List<ExerciseFocus.Row> rows = Arrays.asList(row("Squat", true), row("Bench", true));
        assertNull(ExerciseFocus.nextOpen(rows, "Bench"));
        assertNull(ExerciseFocus.nextOpen(rows, null));
    }

    private static ExerciseFocus.Row row(String name, boolean completed) {
        return new ExerciseFocus.Row(name, completed);
    }
}
